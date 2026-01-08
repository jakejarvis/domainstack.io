import { FatalError, RetryableError } from "workflow";
import type { Provider } from "@/lib/providers/parser";
import type { RegistrationContacts, RegistrationResponse } from "@/lib/types";

export interface RegistrationWorkflowInput {
  domain: string;
}

export type RegistrationWorkflowResult =
  | {
      success: true;
      data: RegistrationResponse;
    }
  | {
      success: false;
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
  error: "unsupported_tld" | "timeout" | "lookup_failed";
}

type RdapLookupResult = RdapLookupSuccess | RdapLookupFailure;

/**
 * Durable registration workflow that breaks down WHOIS/RDAP lookup into
 * independently retryable steps:
 * 1. Lookup via rdapper (WHOIS/RDAP - the slow operation)
 * 2. Normalize registrar provider
 * 3. Persist to database
 */
export async function registrationWorkflow(
  input: RegistrationWorkflowInput,
): Promise<RegistrationWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Lookup via rdapper
  const rdapResult = await lookupWhois(domain);

  if (!rdapResult.success) {
    // Build response for failed lookup
    const errorData = await buildErrorResponse(domain, rdapResult.error);
    return { success: false, error: rdapResult.error, data: errorData };
  }

  // Step 2: Normalize registrar and build response
  const normalizedResult = await normalizeAndBuildResponse(
    domain,
    rdapResult.recordJson,
  );

  // Step 3: Persist to database (only for registered domains)
  let domainId: string | undefined;
  if (normalizedResult.isRegistered) {
    domainId = await persistRegistration(
      domain,
      rdapResult.recordJson,
      normalizedResult,
    );
  }

  return {
    success: true,
    data: { ...normalizedResult, domainId },
  };
}

/**
 * Step: Lookup domain registration via rdapper (WHOIS/RDAP)
 * This is the slow operation that benefits from workflow durability.
 */
async function lookupWhois(domain: string): Promise<RdapLookupResult> {
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

      if (isUnsupported) {
        // Permanent failure - TLD not supported by RDAP, return graceful result
        logger.info({ domain, err: error }, "unsupported TLD");
        return { success: false, error: "unsupported_tld" };
      }

      if (isTimeout) {
        // Transient failure - RDAP server timeout, throw to retry
        logger.warn({ domain, err: error }, "RDAP timeout, will retry");
        throw new RetryableError("RDAP lookup timed out", {
          retryAfter: "10s",
        });
      }

      // Unknown error - throw to trigger retry
      logger.warn({ err: error, domain }, "rdap lookup failed, will retry");
      throw new RetryableError("RDAP lookup failed", { retryAfter: "5s" });
    }

    // Serialize to JSON string for step-to-step transfer
    return { success: true, recordJson: JSON.stringify(record) };
  } catch (err) {
    // Unknown exception - throw to trigger retry
    logger.warn({ err, domain }, "rdap lookup threw, will retry");
    throw new RetryableError("RDAP lookup exception", { retryAfter: "5s" });
  }
}

/**
 * Step: Build error response for failed lookups
 */
async function buildErrorResponse(
  domain: string,
  error: RdapLookupFailure["error"],
): Promise<RegistrationResponse> {
  "use step";

  const { getDomainTld } = await import("rdapper");

  const unavailableReason =
    error === "timeout" ? ("timeout" as const) : ("unsupported_tld" as const);

  return {
    domain,
    tld: getDomainTld(domain) ?? "",
    isRegistered: false,
    status: "unknown",
    unavailableReason,
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
  const { upsertCatalogProviderRef, resolveOrCreateProviderId } = await import(
    "@/lib/db/repos/providers"
  );

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
  let catalogProvider: Provider | null = null;

  const matched = detectRegistrar(registrarName, registrarProviders);
  if (matched) {
    registrarName = matched.name;
    registrarDomain = matched.domain;
    catalogProvider = matched;
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

  // Resolve provider ID for the response (needed for change detection)
  // Only resolve if we have provider info to look up
  const hasProviderInfo = registrarName.trim() || registrarDomain;
  let registrarProviderId: string | null = null;

  if (hasProviderInfo) {
    if (catalogProvider) {
      // Catalog provider: upsert to get/create the ID
      const providerRef = await upsertCatalogProviderRef(catalogProvider);
      registrarProviderId = providerRef.id;
    } else {
      // Discovered provider: resolve or create
      registrarProviderId = await resolveOrCreateProviderId({
        category: "registrar",
        domain: registrarDomain,
        name: registrarName.trim() || null,
      });
    }
  }

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
      id: registrarProviderId,
      name: registrarName.trim() || null,
      domain: registrarDomain,
    },
  };
}

/**
 * Step: Persist registration to database
 * @returns The domain ID from the persisted domain record
 */
async function persistRegistration(
  domain: string,
  recordJson: string,
  response: RegistrationResponse,
): Promise<string> {
  "use step";

  const { getDomainTld } = await import("rdapper");
  const { upsertDomain } = await import("@/lib/db/repos/domains");
  const { upsertRegistration } = await import("@/lib/db/repos/registrations");
  const { scheduleRevalidation } = await import("@/lib/schedule");
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
    // Use the provider ID already resolved in normalizeAndBuildResponse
    const registrarProviderId = response.registrarProvider.id;

    const domainRecord = await upsertDomain({
      name: domain,
      tld: getDomainTld(domain) ?? "",
      unicodeName: record.unicodeName ?? domain,
    });

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

    // Schedule background revalidation
    await scheduleRevalidation(
      domain,
      "registration",
      expiresAt.getTime(),
      domainRecord.lastAccessedAt ?? null,
    );

    logger.debug({ domain }, "registration persisted");

    return domainRecord.id;
  } catch (err) {
    logger.error({ err, domain }, "failed to persist registration");
    throw new FatalError("Failed to persist registration");
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
