import { FatalError } from "workflow";
import type { DnsRecord } from "@/lib/types/domain/dns";
import type { Header } from "@/lib/types/domain/headers";
import type { HostingResponse } from "@/lib/types/domain/hosting";

export interface HostingWorkflowInput {
  domain: string;
  /**
   * DNS records from the dnsWorkflow result.
   * Pass `dnsResult.data.records`.
   */
  dnsRecords: DnsRecord[];
  /**
   * Headers from the headersWorkflow result.
   * Pass `headersResult.data.headers`.
   */
  headers: Header[];
}

export type HostingWorkflowResult =
  | {
      success: true;
      data: HostingResponse;
    }
  | {
      success: false;
      error: string;
      data: HostingResponse | null;
    };

// Internal types for step-to-step transfer
interface GeoIpResult {
  geo: {
    city: string;
    region: string;
    country: string;
    country_emoji: string;
    country_code: string;
    lat: number | null;
    lon: number | null;
  };
  owner: string | null;
  domain: string | null;
}

interface ProviderDetectionResult {
  hostingProvider: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
  emailProvider: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
  dnsProvider: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
}

/**
 * Durable hosting workflow that computes hosting/email/DNS providers
 * from already-fetched DNS records and headers.
 *
 * Unlike other workflows, this one receives its input data rather than
 * fetching it, since DNS and headers are typically already being fetched
 * by their respective workflows.
 *
 * Steps:
 * 1. GeoIP lookup (if IP available)
 * 2. Detect providers from headers and DNS records
 * 3. Persist to database
 */
export async function hostingWorkflow(
  input: HostingWorkflowInput,
): Promise<HostingWorkflowResult> {
  "use workflow";

  const { domain, dnsRecords, headers } = input;

  // Extract IP from A/AAAA records
  const a = dnsRecords.find((d) => d.type === "A");
  const aaaa = dnsRecords.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;

  // Step 1: GeoIP lookup (if we have an IP)
  const geoResult = await lookupGeoIpStep(ip);

  // Step 2: Detect providers and resolve IDs
  const providers = await detectAndResolveProvidersStep(
    dnsRecords,
    headers,
    geoResult,
    ip,
  );

  // Step 3: Persist to database
  await persistHostingStep(domain, providers, geoResult.geo);

  return {
    success: true,
    data: {
      hostingProvider: providers.hostingProvider,
      emailProvider: providers.emailProvider,
      dnsProvider: providers.dnsProvider,
      geo: geoResult.geo,
    },
  };
}

/**
 * Step: Lookup GeoIP data for an IP address.
 */
async function lookupGeoIpStep(ip: string | null): Promise<GeoIpResult> {
  "use step";

  const { lookupGeoIp } = await import("@/lib/domain/hosting-lookup");
  return lookupGeoIp(ip);
}

/**
 * Step: Detect providers from DNS records and headers, then resolve provider IDs.
 */
async function detectAndResolveProvidersStep(
  dnsRecords: DnsRecord[],
  headers: Header[],
  geoResult: GeoIpResult,
  ip: string | null,
): Promise<ProviderDetectionResult> {
  "use step";

  const { detectAndResolveProviders } = await import(
    "@/lib/domain/hosting-lookup"
  );
  return detectAndResolveProviders(dnsRecords, headers, geoResult, ip);
}

/**
 * Step: Persist hosting data to database.
 */
async function persistHostingStep(
  domain: string,
  providers: ProviderDetectionResult,
  geo: GeoIpResult["geo"],
): Promise<void> {
  "use step";

  const { persistHostingData } = await import("@/lib/domain/hosting-lookup");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "hosting-workflow" });

  try {
    await persistHostingData(domain, providers, geo);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist hosting data");
    throw new FatalError("Failed to persist hosting data");
  }
}
