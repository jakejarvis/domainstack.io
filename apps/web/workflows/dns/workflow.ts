import type { DnsRecordsResponse } from "@/lib/types/domain/dns";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  fetchDnsRecordsStep,
  persistDnsRecordsStep,
} from "@/workflows/shared/dns";

export interface DnsWorkflowInput {
  domain: string;
}

/**
 * DNS workflow always succeeds or throws (no permanent typed errors).
 * Transient failures are handled via RetryableError until retries are exhausted.
 */
export type DnsWorkflowResult = WorkflowResult<DnsRecordsResponse>;

/**
 * Durable DNS workflow that breaks down DNS resolution into
 * independently retryable steps:
 * 1. Fetch from DoH providers with fallback
 * 2. Persist to database (creates domain record if needed)
 *
 * Revalidation is handled by SWR (stale-while-revalidate) pattern at the
 * data access layer - when stale data is accessed, a background refresh
 * is triggered automatically.
 */
export async function dnsWorkflow(
  input: DnsWorkflowInput,
): Promise<DnsWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch from DoH providers (throws RetryableError on failure)
  const fetchResult = await fetchDnsRecordsStep(domain);

  // Step 2: Persist to database
  await persistDnsRecordsStep(domain, fetchResult.data);

  return {
    success: true,
    data: {
      records: fetchResult.data.records,
      resolver: fetchResult.data.resolver,
    },
  };
}
