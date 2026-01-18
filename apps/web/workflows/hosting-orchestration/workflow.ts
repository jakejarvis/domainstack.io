import type { Section } from "@/lib/constants/sections";
import type { HostingResponse } from "@/lib/types/domain/hosting";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  fetchDnsRecordsStep,
  persistDnsRecordsStep,
} from "@/workflows/shared/dns";
import {
  fetchHeadersStep,
  persistHeadersStep,
} from "@/workflows/shared/headers";
import {
  detectAndResolveProvidersStep,
  lookupGeoIpStep,
  persistHostingStep,
} from "@/workflows/shared/hosting";
import { scheduleRevalidationBatchStep } from "@/workflows/shared/schedule-batch";

export interface HostingWorkflowInput {
  domain: string;
}

export type HostingWorkflowResult = WorkflowResult<HostingResponse>;

/**
 * Durable hosting workflow that handles the full dependency chain:
 * DNS → headers → hosting detection.
 *
 * This workflow orchestrates all the steps needed to compute hosting providers,
 * including fetching DNS records and headers if needed.
 *
 * Steps:
 * 1. Fetch DNS records (parallel with headers)
 * 2. Fetch HTTP headers (parallel with DNS)
 * 3. Persist DNS and headers
 * 4. GeoIP lookup (if IP available)
 * 5. Detect providers from headers and DNS records
 * 6. Persist hosting data
 * 7. Schedule revalidation for all updated sections
 */
export async function hostingWorkflow(
  input: HostingWorkflowInput,
): Promise<HostingWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1 & 2: Fetch DNS and headers in parallel
  // DNS always succeeds or throws; headers may fail with typed error
  const [dnsResult, headersResult] = await Promise.all([
    fetchDnsRecordsStep(domain),
    fetchHeadersStep(domain),
  ]);

  // Track which sections we updated for batch scheduling
  const updatedSections: Section[] = ["dns"];

  // Always persist DNS data
  let { lastAccessedAt } = await persistDnsRecordsStep(domain, dnsResult.data);

  // If headers failed, we can still proceed with DNS-only provider detection
  // but we persist headers only if successful
  if (headersResult.success) {
    const headersPersistedResult = await persistHeadersStep(
      domain,
      headersResult.data,
    );
    updatedSections.push("headers");
    // Use headers lastAccessedAt if available (both should be same domain)
    lastAccessedAt = headersPersistedResult.lastAccessedAt ?? lastAccessedAt;
  }

  // Use available data for provider detection (prefer full data, fallback to partial)
  const dnsRecords = dnsResult.data.records;
  const headers = headersResult.success ? headersResult.data.headers : [];

  // Step 3: Extract IP from DNS records for GeoIP lookup
  const a = dnsRecords.find((d) => d.type === "A");
  const aaaa = dnsRecords.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;

  // Step 4: GeoIP lookup (if we have an IP)
  const geoResult = ip ? await lookupGeoIpStep(ip) : null;

  // Step 5: Detect providers and resolve IDs
  const providers = await detectAndResolveProvidersStep(
    dnsRecords,
    headers,
    geoResult,
  );

  // Step 6: Persist hosting data to database
  const hostingPersistedResult = await persistHostingStep(
    domain,
    providers,
    geoResult?.geo ?? null,
  );
  updatedSections.push("hosting");
  lastAccessedAt = hostingPersistedResult.lastAccessedAt ?? lastAccessedAt;

  // Step 7: Schedule revalidation for all updated sections
  await scheduleRevalidationBatchStep(domain, updatedSections, lastAccessedAt);

  return {
    success: true,
    data: {
      hostingProvider: providers.hostingProvider,
      emailProvider: providers.emailProvider,
      dnsProvider: providers.dnsProvider,
      geo: geoResult?.geo ?? null,
    },
  };
}
