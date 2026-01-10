import { FatalError, RetryableError } from "workflow";
import type { Header, HeadersResponse } from "@/lib/types/domain/headers";

export interface HeadersWorkflowInput {
  domain: string;
}

export type HeadersWorkflowResult =
  | {
      success: true;
      data: HeadersResponse;
    }
  | {
      success: false;
      // Note: fetch_error is thrown as RetryableError in fetchHeadersStep and never returned
      error: "dns_error" | "tls_error";
      data: HeadersResponse | null;
    };

// Internal types for step-to-step transfer
interface FetchSuccess {
  success: true;
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

interface FetchFailure {
  success: false;
  error: "dns_error" | "tls_error" | "fetch_error";
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

// After fetchHeadersStep processes the result, fetch_error is thrown as RetryableError
// so only dns_error and tls_error are returned to the workflow caller
type FetchResult =
  | FetchSuccess
  | (Omit<FetchFailure, "error"> & { error: "dns_error" | "tls_error" });

/**
 * Durable headers workflow that breaks down HTTP header probing into
 * independently retryable steps:
 * 1. Fetch headers from domain
 * 2. Persist to database (creates domain record if needed)
 */
export async function headersWorkflow(
  input: HeadersWorkflowInput,
): Promise<HeadersWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch headers from domain
  const fetchResult = await fetchHeadersStep(domain);

  // Step 2: Persist to database (only if fetch succeeded)
  if (fetchResult.success) {
    await persistHeadersStep(domain, fetchResult.headers, fetchResult.status);
  }

  if (!fetchResult.success) {
    // Note: fetch_error is thrown as RetryableError in fetchHeadersStep,
    // so it never reaches here. Only dns_error and tls_error are returned.
    return {
      success: false,
      error: fetchResult.error,
      data: {
        headers: fetchResult.headers,
        status: fetchResult.status,
        statusMessage: fetchResult.statusMessage,
      },
    };
  }

  return {
    success: true,
    data: {
      headers: fetchResult.headers,
      status: fetchResult.status,
      statusMessage: fetchResult.statusMessage,
    },
  };
}

/**
 * Step: Fetch HTTP headers from the domain.
 *
 * Note: fetch_error is thrown as RetryableError and never returned,
 * so the return type is narrowed to exclude it.
 */
async function fetchHeadersStep(domain: string): Promise<FetchResult> {
  "use step";

  const { fetchHttpHeaders } = await import("@/lib/domain/headers-lookup");

  const result = await fetchHttpHeaders(domain);

  // fetch_error is retryable, others are permanent
  if (!result.success && result.error === "fetch_error") {
    throw new RetryableError("Headers fetch failed", { retryAfter: "5s" });
  }

  // After the check above, fetch_error is filtered out
  return result as FetchResult;
}

// HTTP header probing can fail due to transient network issues - allow more retries
fetchHeadersStep.maxRetries = 5;

/**
 * Step: Persist headers to Postgres.
 */
async function persistHeadersStep(
  domain: string,
  headers: Header[],
  status: number,
): Promise<void> {
  "use step";

  const { persistHttpHeaders } = await import("@/lib/domain/headers-lookup");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "headers-workflow" });

  try {
    await persistHttpHeaders(domain, headers, status);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist headers");
    throw new FatalError("Failed to persist headers");
  }
}
