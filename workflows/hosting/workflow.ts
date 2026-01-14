import type { DnsRecord } from "@/lib/types/domain/dns";
import type { Header } from "@/lib/types/domain/headers";
import type { HostingResponse } from "@/lib/types/domain/hosting";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  detectAndResolveProvidersStep,
  lookupGeoIpStep,
  persistHostingStep,
} from "@/workflows/shared/hosting";
import { scheduleRevalidationBatchStep } from "@/workflows/shared/revalidation/schedule-batch";

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

export type HostingWorkflowResult = WorkflowResult<HostingResponse>;

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
 * 4. Schedule revalidation
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
  const geoResult = ip ? await lookupGeoIpStep(ip) : null;

  // Step 2: Detect providers and resolve IDs
  const providers = await detectAndResolveProvidersStep(
    dnsRecords,
    headers,
    geoResult,
  );

  // Step 3: Persist to database
  const { lastAccessedAt } = await persistHostingStep(
    domain,
    providers,
    geoResult?.geo ?? null,
  );

  // Step 4: Schedule revalidation
  await scheduleRevalidationBatchStep(domain, ["hosting"], lastAccessedAt);

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
