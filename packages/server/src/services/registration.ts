/**
 * Registration service - fetches, normalizes, and persists WHOIS/RDAP data.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw (for TanStack Query to retry).
 * Permanent errors return { success: false, error }.
 */

import {
  resolveOrCreateProviderId,
  upsertCatalogProvider,
  upsertDomain,
  upsertRegistration,
} from "@domainstack/db/queries";
import type {
  RegistrationContact,
  RegistrationResponse,
} from "@domainstack/types";
import { getDomainTld } from "@domainstack/utils/domain";
import {
  detectRegistrar,
  getProvidersFromCatalog,
  type Provider,
  type ProviderCatalog,
} from "@domainstack/utils/providers";
import { getProviderCatalog } from "../edge-config";
import { ttlForRegistration } from "../ttl";
import { lookupWhois as lookup } from "../whois";

// ============================================================================
// Types
// ============================================================================

export type RegistrationError =
  | "unsupported_tld"
  | "not_found"
  | "lookup_failed";

export type RegistrationResult =
  | { success: true; data: RegistrationResponse }
  | { success: false; error: RegistrationError };

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch, normalize, and persist registration data for a domain.
 *
 * @param domain - The domain to look up
 * @returns Registration result with data or error
 *
 * @throws Error on transient failures (timeout, network) - TanStack Query retries these
 */
export async function fetchRegistration(
  domain: string,
): Promise<RegistrationResult> {
  // 1. Fetch WHOIS/RDAP
  const lookupResult = await lookupWhois(domain);

  if (!lookupResult.success) {
    return { success: false, error: lookupResult.error };
  }

  // 2. Get provider catalog for normalization
  const catalog = await getProviderCatalog();

  // 3. Normalize
  const normalized = await normalizeRegistration(lookupResult.recordJson, {
    catalog,
  });

  // 4. Persist (only for registered domains)
  if (normalized.isRegistered) {
    await persistRegistration(domain, normalized);
  }

  return { success: true, data: normalized };
}

// ============================================================================
// Internal: WHOIS Lookup
// ============================================================================

type LookupResult =
  | { success: true; recordJson: string }
  | { success: false; error: RegistrationError };

async function lookupWhois(domain: string): Promise<LookupResult> {
  const result = await lookup(domain, {
    userAgent: process.env.EXTERNAL_USER_AGENT,
  });

  if (!result.success) {
    // Transient errors throw - let TanStack Query retry
    if (result.error === "retry" || result.error === "timeout") {
      throw new Error(`WHOIS lookup failed: ${result.error}`);
    }
    // Permanent errors return as result
    return { success: false, error: result.error };
  }

  return { success: true, recordJson: result.recordJson };
}

// ============================================================================
// Internal: Normalize Registration
// ============================================================================

interface NormalizeOptions {
  catalog: ProviderCatalog | null;
}

async function normalizeRegistration(
  recordJson: string,
  options: NormalizeOptions,
): Promise<RegistrationResponse> {
  const { catalog } = options;
  const record = JSON.parse(recordJson) as ParsedRdapRecord;
  const registrarProviders = catalog
    ? getProvidersFromCatalog(catalog, "registrar")
    : [];

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

  // Fallback to URL hostname
  if (!registrarDomain && record.registrar?.url) {
    try {
      registrarDomain =
        new URL(record.registrar.url.toString()).hostname || null;
    } catch {
      // URL parsing failed
    }
  }

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
    status: record.isRegistered ? "registered" : "unregistered",
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
    rawResponse: formatRawResponse(record),
  };
}

// ============================================================================
// Internal: Persist Registration
// ============================================================================

async function persistRegistration(
  domain: string,
  response: RegistrationResponse,
): Promise<void> {
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
}

// ============================================================================
// Internal: Types & Helpers
// ============================================================================

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
  rawRdap?: unknown;
  rawWhois?: string;
  source?: "rdap" | "whois" | null;
  warnings?: string[];
}

function formatRawResponse(
  record: ParsedRdapRecord,
): Record<string, unknown> | string | undefined {
  if (record.source === "rdap" && record.rawRdap) {
    return record.rawRdap as Record<string, unknown>;
  }
  if (record.source === "whois" && record.rawWhois) {
    return record.rawWhois;
  }
  return undefined;
}
