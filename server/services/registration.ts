import { eq } from "drizzle-orm";
import { getDomainTld, lookup } from "rdapper";
import { recordDomainAccess } from "@/lib/access";
import { REDIS_TTL_REGISTERED, REDIS_TTL_UNREGISTERED } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { upsertDomain } from "@/lib/db/repos/domains";
import { resolveOrCreateProviderId } from "@/lib/db/repos/providers";
import {
  getRegistrationStatusFromCache,
  setRegistrationStatusInCache,
  upsertRegistration,
} from "@/lib/db/repos/registrations";
import {
  domains,
  providers,
  registrationNameservers,
  registrations,
} from "@/lib/db/schema";
import { ttlForRegistration } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import { detectRegistrar } from "@/lib/providers/detection";
import { getRdapBootstrapData } from "@/lib/rdap-bootstrap";
import { scheduleSectionIfEarlier } from "@/lib/schedule";
import type { Registration, RegistrationContacts } from "@/lib/schemas";

/**
 * Normalize registrar provider information from raw rdapper data.
 * Applies provider detection and falls back to URL hostname parsing.
 */
function normalizeRegistrar(registrar?: { name?: unknown; url?: unknown }): {
  name: string | null;
  domain: string | null;
} {
  let registrarName = (registrar?.name || "").toString();
  let registrarDomain: string | null = null;

  // Run provider detection to normalize known registrars
  const det = detectRegistrar(registrarName);
  if (det.name) {
    registrarName = det.name;
  }
  if (det.domain) {
    registrarDomain = det.domain;
  }

  // Fall back to URL hostname parsing if domain is still unknown
  try {
    if (!registrarDomain && registrar?.url) {
      registrarDomain = new URL(registrar.url.toString()).hostname || null;
    }
  } catch {
    // URL parsing failed, leave domain as null
  }

  return {
    name: registrarName.trim() || null,
    domain: registrarDomain,
  };
}

/**
 * Fetch domain registration using rdapper and cache the normalized DomainRecord.
 */
export async function getRegistration(domain: string): Promise<Registration> {
  console.debug(`[registration] start ${domain}`);

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();

  // ===== Fast path 1: Redis cache for registration status =====
  const cachedStatus = await getRegistrationStatusFromCache(registrable);

  // If Redis cache says unregistered, return minimal Registration object
  if (cachedStatus === false) {
    console.info(`[registration] cache hit unregistered ${registrable}`);
    recordDomainAccess(registrable);
    return {
      domain: registrable,
      tld: getDomainTld(registrable) ?? "",
      isRegistered: false,
      source: null,
      registrarProvider: {
        name: null,
        domain: null,
      },
    };
  }

  // ===== Fast path 2: Postgres cache for full registration data =====
  // Single query to fetch domain + registration + provider
  const existing = await db
    .select({
      domainId: domains.id,
      domainName: domains.name,
      domainTld: domains.tld,
      domainUnicodeName: domains.unicodeName,
      registration: registrations,
      providerName: providers.name,
      providerDomain: providers.domain,
    })
    .from(domains)
    .innerJoin(registrations, eq(registrations.domainId, domains.id))
    .leftJoin(providers, eq(registrations.registrarProviderId, providers.id))
    .where(eq(domains.name, registrable))
    .limit(1);

  if (existing[0] && existing[0].registration.expiresAt > now) {
    const row = existing[0];

    // Fetch nameservers separately (reasonable due to 1-to-many relationship)
    const ns = await db
      .select({
        host: registrationNameservers.host,
        ipv4: registrationNameservers.ipv4,
        ipv6: registrationNameservers.ipv6,
      })
      .from(registrationNameservers)
      .where(eq(registrationNameservers.domainId, row.domainId));

    const registrarProvider = row.providerName
      ? { name: row.providerName, domain: row.providerDomain ?? null }
      : { name: null as string | null, domain: null as string | null };

    const contactsArray: RegistrationContacts = row.registration.contacts ?? [];

    const response: Registration = {
      domain: registrable,
      tld: row.domainTld,
      isRegistered: row.registration.isRegistered,
      privacyEnabled: row.registration.privacyEnabled ?? false,
      unicodeName: row.domainUnicodeName,
      punycodeName: row.domainName,
      registry: row.registration.registry ?? undefined,
      // registrar object is optional; we don't persist its full details, so omit
      statuses: row.registration.statuses ?? undefined,
      creationDate: row.registration.creationDate?.toISOString(),
      updatedDate: row.registration.updatedDate?.toISOString(),
      expirationDate: row.registration.expirationDate?.toISOString(),
      deletionDate: row.registration.deletionDate?.toISOString(),
      transferLock: row.registration.transferLock ?? undefined,
      nameservers:
        ns.length > 0
          ? ns.map((n) => ({ host: n.host, ipv4: n.ipv4, ipv6: n.ipv6 }))
          : undefined,
      contacts: contactsArray,
      whoisServer: row.registration.whoisServer ?? undefined,
      rdapServers: row.registration.rdapServers ?? undefined,
      source: row.registration.source ?? null,
      registrarProvider,
    };

    // Update Redis fast-path cache to keep it hot for subsequent requests
    // Fire-and-forget to avoid blocking the response on Redis latency
    const ttl = row.registration.isRegistered
      ? REDIS_TTL_REGISTERED
      : REDIS_TTL_UNREGISTERED;
    setRegistrationStatusInCache(
      registrable,
      row.registration.isRegistered,
      ttl,
    ).catch((err) => {
      console.warn(
        `[registration] failed to warm Redis cache for ${registrable}:`,
        err instanceof Error ? err : new Error(String(err)),
      );
    });

    // Record access for decay calculation
    recordDomainAccess(registrable);

    // Schedule background revalidation using cached access time
    try {
      await scheduleSectionIfEarlier(
        "registration",
        registrable,
        row.registration.expiresAt.getTime(),
        now,
      );
    } catch (err) {
      console.warn(
        `[registration] schedule failed for ${registrable}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    console.info(
      `[registration] ok cached ${registrable} registered=${row.registration.isRegistered} registrar=${registrarProvider.name}`,
    );

    return response;
  }

  // ===== Slow path: Fetch fresh data from WHOIS/RDAP via rdapper =====
  // Fetch bootstrap data with Next.js caching to avoid redundant IANA requests
  const bootstrapData = await getRdapBootstrapData();

  const { ok, record, error } = await lookup(registrable, {
    timeoutMs: 5000,
    customBootstrapData: bootstrapData,
  });

  if (!ok || !record) {
    // Classify error: some TLDs don't offer public WHOIS/RDAP services
    const isKnownLimitation = isExpectedRegistrationError(error);

    if (isKnownLimitation) {
      console.info(
        `[registration] unavailable ${registrable} reason=${error || "unknown"}`,
      );

      // Record access for decay calculation (even for unavailable domains)
      recordDomainAccess(registrable);

      // Return minimal unregistered response for TLDs without WHOIS/RDAP
      // (We can't determine registration status without WHOIS/RDAP access)
      return {
        domain: registrable,
        tld: getDomainTld(registrable) ?? "",
        isRegistered: false,
        source: null,
        registrarProvider: {
          name: null,
          domain: null,
        },
      };
    }

    // Actual errors (timeouts, network failures, etc.) are still logged as errors
    const err = new Error(
      `Registration lookup failed for ${registrable}: ${error || "unknown error"}`,
    );
    console.error(
      `[registration] error ${registrable}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    throw err;
  }

  // Cache the registration status (true/false) in Redis for fast lookups
  // Fire-and-forget to avoid blocking the response on Redis latency
  const ttl = record.isRegistered
    ? REDIS_TTL_REGISTERED
    : REDIS_TTL_UNREGISTERED;
  setRegistrationStatusInCache(registrable, record.isRegistered, ttl).catch(
    (err) => {
      console.warn(
        `[registration] failed to cache status for ${registrable}:`,
        err instanceof Error ? err : new Error(String(err)),
      );
    },
  );

  // If unregistered, return response without persisting to Postgres
  if (!record.isRegistered) {
    console.info(
      `[registration] ok ${registrable} unregistered (not persisted)`,
    );

    // Record access for decay calculation
    recordDomainAccess(registrable);

    const registrarProvider = normalizeRegistrar(record.registrar ?? {});

    // Explicitly construct Registration object to avoid leaking rdapper internals
    return {
      domain: record.domain,
      tld: record.tld,
      isRegistered: record.isRegistered,
      unicodeName: record.unicodeName,
      punycodeName: record.punycodeName,
      registry: record.registry,
      registrar: record.registrar,
      reseller: record.reseller,
      statuses: record.statuses,
      creationDate: record.creationDate,
      updatedDate: record.updatedDate,
      expirationDate: record.expirationDate,
      deletionDate: record.deletionDate,
      transferLock: record.transferLock,
      dnssec: record.dnssec,
      nameservers: record.nameservers,
      contacts: record.contacts,
      privacyEnabled: record.privacyEnabled,
      whoisServer: record.whoisServer,
      rdapServers: record.rdapServers,
      source: record.source,
      warnings: record.warnings,
      registrarProvider,
    };
  }

  // ===== Persist registered domain to Postgres =====
  const registrarProvider = normalizeRegistrar(record.registrar ?? {});

  // Explicitly construct Registration object to avoid leaking rdapper internals
  const withProvider: Registration = {
    domain: record.domain,
    tld: record.tld,
    isRegistered: record.isRegistered,
    unicodeName: record.unicodeName,
    punycodeName: record.punycodeName,
    registry: record.registry,
    registrar: record.registrar,
    reseller: record.reseller,
    statuses: record.statuses,
    creationDate: record.creationDate,
    updatedDate: record.updatedDate,
    expirationDate: record.expirationDate,
    deletionDate: record.deletionDate,
    transferLock: record.transferLock,
    dnssec: record.dnssec,
    nameservers: record.nameservers,
    contacts: record.contacts,
    privacyEnabled: record.privacyEnabled,
    whoisServer: record.whoisServer,
    rdapServers: record.rdapServers,
    source: record.source,
    warnings: record.warnings,
    registrarProvider,
  };

  // Upsert domain record and resolve registrar provider in parallel (independent operations)
  const [domainRecord, registrarProviderId] = await Promise.all([
    upsertDomain({
      name: registrable,
      tld: getDomainTld(registrable) ?? "",
      unicodeName: record.unicodeName ?? registrable,
    }),
    resolveOrCreateProviderId({
      category: "registrar",
      domain: registrarProvider.domain,
      name: registrarProvider.name,
    }),
  ]);

  const expiresAt = ttlForRegistration(
    now,
    record.expirationDate ? new Date(record.expirationDate) : null,
  );

  await upsertRegistration({
    domainId: domainRecord.id,
    isRegistered: record.isRegistered,
    privacyEnabled: record.privacyEnabled ?? false,
    registry: record.registry ?? null,
    creationDate: record.creationDate ? new Date(record.creationDate) : null,
    updatedDate: record.updatedDate ? new Date(record.updatedDate) : null,
    expirationDate: record.expirationDate
      ? new Date(record.expirationDate)
      : null,
    deletionDate: record.deletionDate ? new Date(record.deletionDate) : null,
    transferLock: record.transferLock ?? null,
    statuses: record.statuses ?? [],
    contacts: record.contacts ?? [],
    whoisServer: record.whoisServer ?? null,
    rdapServers: record.rdapServers ?? [],
    source: record.source,
    registrarProviderId,
    resellerProviderId: null,
    fetchedAt: now,
    expiresAt,
    nameservers: (record.nameservers ?? []).map((n) => ({
      host: n.host,
      ipv4: n.ipv4 ?? [],
      ipv6: n.ipv6 ?? [],
    })),
  });

  // Record access for decay calculation
  recordDomainAccess(registrable);

  // Schedule background revalidation
  try {
    await scheduleSectionIfEarlier(
      "registration",
      registrable,
      expiresAt.getTime(),
      now, // Use current access time, not stale DB timestamp
    );
  } catch (err) {
    console.warn(
      `[registration] schedule failed for ${registrable}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  console.info(
    `[registration] ok ${registrable} registered=${record.isRegistered} registrar=${withProvider.registrarProvider.name}`,
  );

  return withProvider;
}

/**
 * Check if a registration error is an expected limitation.
 * These occur when TLDs don't offer public WHOIS/RDAP services.
 */
function isExpectedRegistrationError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();

  // Known patterns indicating TLD doesn't support public WHOIS/RDAP
  return (
    errorStr.includes("no whois server discovered") ||
    errorStr.includes("no rdap server found") ||
    errorStr.includes("registry may not publish public whois") ||
    errorStr.includes("tld is not supported") ||
    errorStr.includes("no whois server configured") ||
    // Timeouts often indicate WHOIS server is unreachable/unresponsive
    errorStr.includes("whois socket timeout") ||
    errorStr.includes("whois timeout") ||
    errorStr.includes("rdap timeout")
  );
}
