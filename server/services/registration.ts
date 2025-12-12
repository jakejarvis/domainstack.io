import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDomainTld, lookup } from "rdapper";
import { db } from "@/lib/db/client";
import { upsertDomain } from "@/lib/db/repos/domains";
import { resolveOrCreateProviderId } from "@/lib/db/repos/providers";
import { upsertRegistration } from "@/lib/db/repos/registrations";
import { domains, providers, registrations } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";
import { detectRegistrar } from "@/lib/providers/detection";
import { getRdapBootstrapData } from "@/lib/rdap-bootstrap";
import { scheduleRevalidation } from "@/lib/schedule";
import type { RegistrationContacts, RegistrationResponse } from "@/lib/schemas";
import { ttlForRegistration } from "@/lib/ttl";

const logger = createLogger({ source: "registration" });

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
export async function getRegistration(
  domain: string,
): Promise<RegistrationResponse> {
  // Input domain is already normalized to registrable domain by router schema
  logger.debug("start", { domain });

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();

  // ===== Fast path: Postgres cache for full registration data =====
  // Single query to fetch domain + registration + provider
  const existing = await db
    .select({
      domainId: domains.id,
      domainName: domains.name,
      domainTld: domains.tld,
      domainUnicodeName: domains.unicodeName,
      domainLastAccessedAt: domains.lastAccessedAt,
      registration: registrations,
      providerName: providers.name,
      providerDomain: providers.domain,
    })
    .from(domains)
    .innerJoin(registrations, eq(registrations.domainId, domains.id))
    .leftJoin(providers, eq(registrations.registrarProviderId, providers.id))
    .where(eq(domains.name, domain))
    .limit(1);

  if (existing[0] && existing[0].registration.expiresAt > now) {
    const row = existing[0];

    const registrarProvider = row.providerName
      ? { name: row.providerName, domain: row.providerDomain ?? null }
      : { name: null as string | null, domain: null as string | null };

    const contactsArray: RegistrationContacts = row.registration.contacts ?? [];
    const nameserversArray = row.registration.nameservers ?? [];

    const response: RegistrationResponse = {
      domain,
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
      nameservers: nameserversArray.length > 0 ? nameserversArray : undefined,
      contacts: contactsArray,
      whoisServer: row.registration.whoisServer ?? undefined,
      rdapServers: row.registration.rdapServers ?? undefined,
      source: row.registration.source ?? null,
      registrarProvider,
    };

    // Add span attributes for cache hit
    // Schedule background revalidation using actual last access time
    after(() => {
      scheduleRevalidation(
        domain,
        "registration",
        row.registration.expiresAt.getTime(),
        row.domainLastAccessedAt ?? null,
      ).catch((err) => {
        logger.error("schedule failed", err, {
          domain,
        });
      });
    });

    logger.info("cache hit", { domain });

    return response;
  }

  // ===== Slow path: Fetch fresh data from WHOIS/RDAP via rdapper =====
  // Fetch bootstrap data with Next.js caching to avoid redundant IANA requests
  const bootstrapData = await getRdapBootstrapData();

  const { ok, record, error } = await lookup(domain, {
    timeoutMs: 5000,
    customBootstrapData: bootstrapData,
  });

  if (!ok || !record) {
    // Classify error types to distinguish infrastructure issues from unsupported TLDs
    const isUnsupported = isExpectedRegistrationError(error);
    const isTimeout = isTimeoutError(error);

    if (isUnsupported || isTimeout) {
      logger.info(isTimeout ? "timeout" : "unavailable", {
        domain,
        reason: error || "unknown",
      });

      // Return minimal response with source: null indicating unknown status
      // Note: isRegistered: false doesn't mean "confirmed unregistered",
      // it means "status unknown due to WHOIS/RDAP unavailability"
      return {
        domain,
        tld: getDomainTld(domain) ?? "",
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
      `Registration lookup failed for ${domain}: ${error || "unknown error"}`,
    );
    logger.error("lookup failed", err, { domain });
    throw err;
  }

  // If unregistered, return response without persisting to Postgres
  if (!record.isRegistered) {
    logger.info("unregistered (not persisted)", { domain });

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
  const withProvider: RegistrationResponse = {
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
      name: domain,
      tld: getDomainTld(domain) ?? "",
      unicodeName: record.unicodeName ?? domain,
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

  // Schedule background revalidation
  after(() => {
    scheduleRevalidation(
      domain,
      "registration",
      expiresAt.getTime(),
      domainRecord.lastAccessedAt ?? null,
    ).catch((err) => {
      logger.error("schedule failed", err, {
        domain,
      });
    });
  });

  logger.info("done", { domain });

  return withProvider;
}

/**
 * Check if a registration error is an expected limitation.
 * These occur when TLDs don't offer public WHOIS/RDAP services.
 * Excludes transient errors like timeouts.
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
    errorStr.includes("no whois server configured")
  );
}

/**
 * Check if an error indicates a timeout (connectivity issue).
 * Tracked separately from unsupported TLDs to distinguish infrastructure problems.
 */
function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes("whois socket timeout") ||
    errorStr.includes("whois timeout") ||
    errorStr.includes("rdap timeout")
  );
}
