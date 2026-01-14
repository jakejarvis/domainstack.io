import type { HeadersResponse } from "@/lib/types/domain/headers";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  fetchHeadersStep,
  type HeadersError,
  persistHeadersStep,
} from "@/workflows/shared/headers";
import { scheduleRevalidationBatchStep } from "@/workflows/shared/revalidation/schedule-batch";

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
 * 3. Schedule revalidation
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
  const { lastAccessedAt } = await persistHeadersStep(domain, fetchResult.data);

  // Step 3: Schedule revalidation
  await scheduleRevalidationBatchStep(domain, ["headers"], lastAccessedAt);

  return {
    success: true,
    data: {
      headers: fetchResult.data.headers,
      status: fetchResult.data.status,
      statusMessage: fetchResult.data.statusMessage,
    },
  };
}
