import type { HeadersResponse } from "@/lib/types/domain/headers";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  fetchHeadersStep,
  type HeadersError,
  persistHeadersStep,
} from "@/workflows/shared/headers";

export interface HeadersWorkflowInput {
  domain: string;
}

export type HeadersWorkflowResult = WorkflowResult<
  HeadersResponse,
  HeadersError
>;

/**
 * Durable headers workflow that breaks down HTTP header probing into
 * independently retryable steps:
 * 1. Fetch headers from domain
 * 2. Persist to database (creates domain record if needed)
 *
 * Revalidation is handled by SWR (stale-while-revalidate) pattern at the
 * data access layer - when stale data is accessed, a background refresh
 * is triggered automatically.
 */
export async function headersWorkflow(
  input: HeadersWorkflowInput,
): Promise<HeadersWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch headers from domain
  const fetchResult = await fetchHeadersStep(domain);

  if (!fetchResult.success) {
    // dns_error and tls_error are permanent failures
    return {
      success: false,
      error: fetchResult.error,
      data: null,
    };
  }

  // Step 2: Persist to database
  await persistHeadersStep(domain, fetchResult.data);

  return {
    success: true,
    data: {
      headers: fetchResult.data.headers,
      status: fetchResult.data.status,
      statusMessage: fetchResult.data.statusMessage,
    },
  };
}
