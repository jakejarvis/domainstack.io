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

// Note: Database imports are dynamic to avoid initialization issues in tests
import type { RegistrationContacts, RegistrationResponse } from "@/lib/types";

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
  contacts?: RegistrationContacts;
  privacyEnabled?: boolean;
  whoisServer?: string;
  rdapServers?: string[];
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
  const { resolveOrCreateProviderId, upsertCatalogProviderRef } = await import(
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
      const providerRef = await upsertCatalogProviderRef(catalogProvider);
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
  };
}

/**
 * Persist registration to database.
 *
 * @returns The domain ID from the persisted domain record
 */
export async function persistRegistrationData(
  domain: string,
  recordJson: string,
  response: RegistrationResponse,
): Promise<string> {
  // Dynamic imports for database operations
  const { upsertDomain } = await import("@/lib/db/repos/domains");
  const { upsertRegistration } = await import("@/lib/db/repos/registrations");
  const { scheduleRevalidation } = await import("@/lib/schedule");

  const record = JSON.parse(recordJson) as ParsedRdapRecord;
  const now = new Date();

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
      const domainId = await persistRegistrationData(
        domain,
        rdapResult.recordJson,
        response,
      );
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
