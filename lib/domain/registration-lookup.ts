/**
 * Registration lookup implementation - core logic for WHOIS/RDAP lookups.
 *
 * This module contains the business logic extracted from the registration workflow.
 * It's used by both the standalone registrationWorkflow and shared steps.
 */

import { getDomainTld, lookup } from "rdapper";
import { createLogger } from "@/lib/logger/server";
import { getProviders } from "@/lib/providers/catalog";
import { detectRegistrar } from "@/lib/providers/detection";
import type { Provider } from "@/lib/providers/parser";
import { getRdapBootstrapData } from "@/lib/rdap-bootstrap";
import { ttlForRegistration } from "@/lib/ttl";
import type {
  RegistrationContact,
  RegistrationResponse,
} from "@/lib/types/domain/registration";

const logger = createLogger({ source: "registration-lookup" });

export interface RdapLookupSuccess {
  success: true;
  recordJson: string;
}

export interface RdapLookupFailure {
  success: false;
  error: "unsupported_tld" | "timeout" | "lookup_failed" | "retry";
}

export type RdapLookupResult = RdapLookupSuccess | RdapLookupFailure;

/**
 * Lookup domain registration via RDAP/WHOIS.
 *
 * Returns the raw RDAP record as JSON string, or an error.
 * "retry" error means the caller should retry the operation.
 */
export async function lookupRdap(domain: string): Promise<RdapLookupResult> {
  try {
    const bootstrapData = await getRdapBootstrapData();

    const { ok, record, error } = await lookup(domain, {
      timeoutMs: 5000,
      customBootstrapData: bootstrapData,
      includeRaw: true,
    });

    if (!ok || !record) {
      const isUnsupported = isExpectedRegistrationError(error);
      const isTimeout = isTimeoutError(error);

      if (isUnsupported) {
        logger.info({ domain, err: error }, "unsupported TLD");
        return { success: false, error: "unsupported_tld" };
      }

      if (isTimeout) {
        logger.warn({ domain, err: error }, "RDAP timeout");
        return { success: false, error: "timeout" };
      }

      logger.warn({ err: error, domain }, "rdap lookup failed");
      return { success: false, error: "retry" };
    }

    return { success: true, recordJson: JSON.stringify(record) };
  } catch (err) {
    logger.warn({ err, domain }, "rdap lookup threw");
    return { success: false, error: "retry" };
  }
}

/**
 * Build an error response for failed lookups.
 */
export function buildErrorResponse(
  domain: string,
  error: RdapLookupFailure["error"],
): RegistrationResponse {
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

// Type for parsed RDAP record
interface ParsedRdapRecord {
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
  contacts?: RegistrationContact[];
  privacyEnabled?: boolean;
  whoisServer?: string;
  rdapServers?: string[];
  /** Raw RDAP JSON response from the registry */
  rawRdap?: unknown;
  /** Raw WHOIS text response from the registry */
  rawWhois?: string;
  source?: "rdap" | "whois" | null;
  warnings?: string[];
}

/**
 * Normalize RDAP record and build response with resolved provider.
 */
export async function normalizeRdapRecord(
  recordJson: string,
): Promise<RegistrationResponse> {
  // Dynamic imports for database operations
  const { resolveOrCreateProviderId, upsertCatalogProvider } = await import(
    "@/lib/db/repos/providers"
  );

  const record = JSON.parse(recordJson) as ParsedRdapRecord;
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

  // Resolve provider ID
  const hasProviderInfo = registrarName.trim() || registrarDomain;
  let registrarProviderId: string | null = null;

  if (hasProviderInfo) {
    if (catalogProvider) {
      const providerRef = await upsertCatalogProvider(catalogProvider);
      registrarProviderId = providerRef.id;
    } else {
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
    // Format raw response as string: RDAP as pretty JSON, WHOIS as plain text
    rawResponse: formatRawResponse(record),
  };
}

/**
 * Format raw response as a string for display.
 * RDAP responses are pretty-printed JSON, WHOIS responses are plain text.
 */
function formatRawResponse(record: ParsedRdapRecord): string | undefined {
  if (record.source === "rdap" && record.rawRdap) {
    return JSON.stringify(record.rawRdap, null, 2);
  }
  if (record.source === "whois" && record.rawWhois) {
    return record.rawWhois;
  }
  return undefined;
}

/**
 * Persist registration to database.
 *
 * Uses the normalized RegistrationResponse directly - no need to re-parse JSON.
 *
 * @returns The domain ID from the persisted domain record
 */
export async function persistRegistrationData(
  domain: string,
  response: RegistrationResponse,
): Promise<string> {
  // Dynamic imports for database operations
  const { upsertDomain } = await import("@/lib/db/repos/domains");
  const { upsertRegistration } = await import("@/lib/db/repos/registrations");
  const { scheduleRevalidation } = await import("@/lib/schedule");

  const now = new Date();

  const domainRecord = await upsertDomain({
    name: domain,
    tld: getDomainTld(domain) ?? "",
    unicodeName: response.unicodeName ?? domain,
  });

  const expiresAt = ttlForRegistration(
    now,
    response.expirationDate ? new Date(response.expirationDate) : null,
  );

  await upsertRegistration({
    domainId: domainRecord.id,
    isRegistered: response.isRegistered,
    privacyEnabled: response.privacyEnabled ?? false,
    registry: response.registry ?? null,
    creationDate: response.creationDate
      ? new Date(response.creationDate)
      : null,
    updatedDate: response.updatedDate ? new Date(response.updatedDate) : null,
    expirationDate: response.expirationDate
      ? new Date(response.expirationDate)
      : null,
    deletionDate: response.deletionDate
      ? new Date(response.deletionDate)
      : null,
    transferLock: response.transferLock ?? null,
    statuses: response.statuses ?? [],
    contacts: response.contacts ?? [],
    whoisServer: response.whoisServer ?? null,
    rdapServers: response.rdapServers ?? [],
    source: response.source ?? "rdap",
    registrarProviderId: response.registrarProvider.id,
    resellerProviderId: null,
    fetchedAt: now,
    expiresAt,
    nameservers: (response.nameservers ?? []).map((n) => ({
      host: n.host,
      ipv4: n.ipv4 ?? [],
      ipv6: n.ipv6 ?? [],
    })),
    rawResponse: response.rawResponse,
  });

  await scheduleRevalidation(
    domain,
    "registration",
    expiresAt.getTime(),
    domainRecord.lastAccessedAt ?? null,
  );

  logger.debug({ domain }, "registration persisted");

  return domainRecord.id;
}

/**
 * Full registration lookup and persist in one operation.
 *
 * This is the main entry point for shared steps.
 */
export async function lookupAndPersistRegistration(
  domain: string,
): Promise<RegistrationResponse | null> {
  const rdapResult = await lookupRdap(domain);

  if (!rdapResult.success) {
    if (rdapResult.error === "retry") {
      return null; // Caller should retry
    }
    // Return error response for permanent failures
    return buildErrorResponse(domain, rdapResult.error);
  }

  const response = await normalizeRdapRecord(rdapResult.recordJson);

  // Only persist for registered domains
  if (response.isRegistered) {
    try {
      const domainId = await persistRegistrationData(domain, response);
      return { ...response, domainId };
    } catch (err) {
      logger.error({ err, domain }, "failed to persist registration");
      // Still return the data even if persistence failed
    }
  }

  return response;
}

// Helper functions
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

function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes("whois socket timeout") ||
    errorStr.includes("whois timeout") ||
    errorStr.includes("rdap timeout")
  );
}
