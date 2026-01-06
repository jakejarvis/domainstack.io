import type {
  Provider,
  RegistrationContacts,
  RegistrationResponse,
} from "@/lib/schemas";

export interface RegistrationWorkflowInput {
  domain: string;
}

export type RegistrationWorkflowResult =
  | {
      success: true;
      cached: boolean;
      data: RegistrationResponse;
    }
  | {
      success: false;
      cached: false;
      error: "unsupported_tld" | "timeout" | "lookup_failed";
      data: RegistrationResponse | null;
    };

// Internal types for rdapper result - serializable for step-to-step transfer
interface RdapLookupSuccess {
  success: true;
  // Stringified JSON of the rdapper record for serialization
  recordJson: string;
}

interface RdapLookupFailure {
  success: false;
  isUnsupported: boolean;
  isTimeout: boolean;
}

type RdapLookupResult = RdapLookupSuccess | RdapLookupFailure;

/**
 * Durable registration workflow that breaks down WHOIS/RDAP lookup into
 * independently retryable steps:
 * 1. Check cache (Postgres)
 * 2. Lookup via rdapper (WHOIS/RDAP - the slow operation)
 * 3. Normalize registrar provider
 * 4. Persist to database
 */
export async function registrationWorkflow(
  input: RegistrationWorkflowInput,
): Promise<RegistrationWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Check Postgres cache
  const cachedResult = await checkCache(domain);

  if (cachedResult.found) {
    return {
      success: true,
      cached: true,
      data: cachedResult.data,
    };
  }

  // Step 2: Lookup via rdapper
  const rdapResult = await lookupRdap(domain);

  if (!rdapResult.success) {
    // Build response for failed lookup
    const errorData = await buildErrorResponse(
      domain,
      rdapResult.isTimeout,
      rdapResult.isUnsupported,
    );

    return {
      success: false,
      cached: false,
      error: rdapResult.isTimeout
        ? "timeout"
        : rdapResult.isUnsupported
          ? "unsupported_tld"
          : "lookup_failed",
      data: errorData,
    };
  }

  // Step 3: Normalize registrar and build response
  const normalizedResult = await normalizeAndBuildResponse(
    domain,
    rdapResult.recordJson,
  );

  // Step 4: Persist to database (only for registered domains)
  if (normalizedResult.isRegistered) {
    await persistRegistration(domain, rdapResult.recordJson, normalizedResult);
  }

  return {
    success: true,
    cached: false,
    data: normalizedResult,
  };
}

/**
 * Step: Check Postgres cache for existing registration data
 */
async function checkCache(
  domain: string,
): Promise<{ found: true; data: RegistrationResponse } | { found: false }> {
  "use step";

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { domains, registrations, providers } = await import("@/lib/db/schema");

  const now = new Date();

  try {
    const existing = await db
      .select({
        domainId: domains.id,
        domainName: domains.name,
        domainTld: domains.tld,
        domainUnicodeName: domains.unicodeName,
        registration: registrations,
        providerId: providers.id,
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
        ? {
            id: row.providerId ?? null,
            name: row.providerName,
            domain: row.providerDomain ?? null,
          }
        : {
            id: null,
            name: null as string | null,
            domain: null as string | null,
          };

      const contactsArray: RegistrationContacts =
        row.registration.contacts ?? [];
      const nameserversArray = row.registration.nameservers ?? [];

      const response: RegistrationResponse = {
        domain,
        tld: row.domainTld,
        isRegistered: row.registration.isRegistered,
        status: row.registration.isRegistered ? "registered" : "unregistered",
        unavailableReason: undefined,
        privacyEnabled: row.registration.privacyEnabled ?? false,
        unicodeName: row.domainUnicodeName,
        punycodeName: row.domainName,
        registry: row.registration.registry ?? undefined,
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

      return { found: true, data: response };
    }
  } catch {
    // Cache check failed, fall through to lookup
  }

  return { found: false };
}

/**
 * Step: Lookup domain registration via rdapper (WHOIS/RDAP)
 * This is the slow operation that benefits from workflow durability.
 */
async function lookupRdap(domain: string): Promise<RdapLookupResult> {
  "use step";

  const { lookup } = await import("rdapper");
  const { getRdapBootstrapData } = await import("@/lib/rdap-bootstrap");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "registration-workflow" });

  try {
    const bootstrapData = await getRdapBootstrapData();

    const { ok, record, error } = await lookup(domain, {
      timeoutMs: 5000,
      customBootstrapData: bootstrapData,
    });

    if (!ok || !record) {
      const isUnsupported = isExpectedRegistrationError(error);
      const isTimeout = isTimeoutError(error);

      if (isUnsupported || isTimeout) {
        logger.info(
          { domain, err: error },
          isTimeout ? "timeout" : "unavailable",
        );
        return { success: false, isUnsupported, isTimeout };
      }

      logger.error({ err: error, domain }, "rdap lookup failed");
      return { success: false, isUnsupported: false, isTimeout: false };
    }

    // Serialize to JSON string for step-to-step transfer
    return { success: true, recordJson: JSON.stringify(record) };
  } catch (err) {
    logger.error({ err, domain }, "rdap lookup threw");
    return { success: false, isUnsupported: false, isTimeout: false };
  }
}

/**
 * Step: Build error response for failed lookups
 */
async function buildErrorResponse(
  domain: string,
  isTimeout: boolean,
  isUnsupported: boolean,
): Promise<RegistrationResponse> {
  "use step";

  const { getDomainTld } = await import("rdapper");

  const unavailableReason = isTimeout
    ? ("timeout" as const)
    : ("unsupported_tld" as const);

  return {
    domain,
    tld: getDomainTld(domain) ?? "",
    isRegistered: false,
    status: "unknown",
    unavailableReason:
      isUnsupported || isTimeout ? unavailableReason : undefined,
    source: null,
    registrarProvider: {
      id: null,
      name: null,
      domain: null,
    },
  };
}

/**
 * Step: Normalize registrar and build response
 */
async function normalizeAndBuildResponse(
  _domain: string,
  recordJson: string,
): Promise<RegistrationResponse> {
  "use step";

  const { getProviders } = await import("@/lib/providers/catalog");
  const { detectRegistrar } = await import("@/lib/providers/detection");

  // Parse the serialized record
  const record = JSON.parse(recordJson) as {
    domain: string;
    tld: string;
    isRegistered: boolean;
    unicodeName?: string;
    punycodeName?: string;
    registry?: string;
    registrar?: { name?: string; url?: string };
    reseller?: { name?: string };
    statuses?: Array<{ status: string; description?: string; raw?: string }>;
    creationDate?: string;
    updatedDate?: string;
    expirationDate?: string;
    deletionDate?: string;
    transferLock?: boolean;
    dnssec?: {
      enabled: boolean;
      dsRecords?: Array<{
        keyTag?: number;
        algorithm?: number;
        digestType?: number;
        digest?: string;
      }>;
    };
    nameservers?: Array<{ host: string; ipv4?: string[]; ipv6?: string[] }>;
    contacts?: RegistrationContacts;
    privacyEnabled?: boolean;
    whoisServer?: string;
    rdapServers?: string[];
    source?: "rdap" | "whois" | null;
    warnings?: string[];
  };

  const registrarProviders = await getProviders("registrar");

  // Normalize registrar
  let registrarName = (record.registrar?.name || "").toString();
  let registrarDomain: string | null = null;
  let _catalogProvider: Provider | null = null;

  const matched = detectRegistrar(registrarName, registrarProviders);
  if (matched) {
    registrarName = matched.name;
    registrarDomain = matched.domain;
    _catalogProvider = matched;
  }

  // Fallback to URL hostname parsing
  try {
    if (!registrarDomain && record.registrar?.url) {
      registrarDomain =
        new URL(record.registrar.url.toString()).hostname || null;
    }
  } catch {
    // URL parsing failed
  }

  const status = record.isRegistered ? "registered" : "unregistered";

  return {
    domain: record.domain,
    tld: record.tld,
    isRegistered: record.isRegistered,
    status,
    unavailableReason: undefined,
    unicodeName: record.unicodeName,
    punycodeName: record.punycodeName,
    registry: record.registry,
    registrar: record.registrar,
    // rdapper returns reseller as {name?: string}, but schema expects string
    reseller: record.reseller?.name,
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
    source: record.source ?? null,
    warnings: record.warnings,
    registrarProvider: {
      // ID will be resolved during persistence, not during normalization
      id: null,
      name: registrarName.trim() || null,
      domain: registrarDomain,
    },
  };
}

/**
 * Step: Persist registration to database
 */
async function persistRegistration(
  domain: string,
  recordJson: string,
  response: RegistrationResponse,
): Promise<void> {
  "use step";

  const { getDomainTld } = await import("rdapper");
  const { upsertDomain } = await import("@/lib/db/repos/domains");
  const { resolveOrCreateProviderId, upsertCatalogProviderRef } = await import(
    "@/lib/db/repos/providers"
  );
  const { upsertRegistration } = await import("@/lib/db/repos/registrations");
  const { getProviders } = await import("@/lib/providers/catalog");
  const { detectRegistrar } = await import("@/lib/providers/detection");
  const { ttlForRegistration } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "registration-workflow" });
  const now = new Date();

  // Parse the serialized record
  const record = JSON.parse(recordJson) as {
    domain: string;
    tld: string;
    isRegistered: boolean;
    unicodeName?: string;
    registrar?: { name?: string; url?: string };
    statuses?: Array<{ status: string; description?: string; raw?: string }>;
    creationDate?: string;
    updatedDate?: string;
    expirationDate?: string;
    deletionDate?: string;
    transferLock?: boolean;
    nameservers?: Array<{ host: string; ipv4?: string[]; ipv6?: string[] }>;
    contacts?: RegistrationContacts;
    privacyEnabled?: boolean;
    whoisServer?: string;
    rdapServers?: string[];
    source?: "rdap" | "whois" | null;
    registry?: string;
  };

  try {
    // Get registrar providers for matching
    const registrarProviders = await getProviders("registrar");
    const matched = detectRegistrar(
      (record.registrar?.name || "").toString(),
      registrarProviders,
    );

    // Resolve provider ID
    const [domainRecord, registrarProviderId] = await Promise.all([
      upsertDomain({
        name: domain,
        tld: getDomainTld(domain) ?? "",
        unicodeName: record.unicodeName ?? domain,
      }),
      matched
        ? upsertCatalogProviderRef(matched).then((r) => r.id)
        : resolveOrCreateProviderId({
            category: "registrar",
            domain: response.registrarProvider.domain,
            name: response.registrarProvider.name,
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
      // rdapper always provides source for successful lookups, default to "rdap" for safety
      source: record.source ?? "rdap",
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

    logger.debug({ domain }, "registration persisted");
  } catch (err) {
    logger.error({ err, domain }, "failed to persist registration");
    // Don't throw - persistence failure shouldn't fail the workflow
  }
}

/**
 * Check if a registration error is an expected limitation.
 */
function isExpectedRegistrationError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();

  return (
    errorStr.includes("no whois server discovered") ||
    errorStr.includes("no rdap server found") ||
    errorStr.includes("registry may not publish public whois") ||
    errorStr.includes("tld is not supported") ||
    errorStr.includes("no whois server configured")
  );
}

/**
 * Check if an error indicates a timeout.
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
