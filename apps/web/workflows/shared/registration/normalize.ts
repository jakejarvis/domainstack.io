/**
 * Registration normalize step.
 *
 * Normalizes RDAP/WHOIS record and resolves registrar provider.
 * This step is shared between the dedicated registrationWorkflow and internal workflows.
 */

import type { Provider } from "@domainstack/core/providers";
import type {
  RegistrationContact,
  RegistrationResponse,
} from "@domainstack/types";

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
 * Step: Normalize registrar and build response.
 *
 * @param recordJson - JSON-serialized RDAP/WHOIS record
 * @returns Normalized RegistrationResponse
 */
export async function normalizeAndBuildResponseStep(
  recordJson: string,
): Promise<RegistrationResponse> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { getProviderCatalog } = await import("@/lib/edge-config");
  const { detectRegistrar, getProvidersFromCatalog } = await import(
    "@domainstack/core/providers"
  );
  const { upsertCatalogProvider, resolveOrCreateProviderId } = await import(
    "@domainstack/db/queries"
  );

  const record = JSON.parse(recordJson) as ParsedRdapRecord;
  const catalog = await getProviderCatalog();
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
 * Get raw response for storage.
 * RDAP responses are returned as JSON objects, WHOIS responses as plain text.
 * Client-side code is responsible for prettification when displaying.
 */
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
