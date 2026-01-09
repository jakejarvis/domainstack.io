import { FatalError, RetryableError } from "workflow";
import type { Header, HeadersResponse } from "@/lib/types";

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

type FetchResult = FetchSuccess | FetchFailure;

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
    // Map fetch_error to tls_error for backwards compatibility
    const error =
      fetchResult.error === "fetch_error" ? "tls_error" : fetchResult.error;
    return {
      success: false,
      error,
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
 */
async function fetchHeadersStep(domain: string): Promise<FetchResult> {
  "use step";

  const { fetchHttpHeaders } = await import("@/lib/domain/headers-lookup");

  const result = await fetchHttpHeaders(domain);

  // fetch_error is retryable, others are permanent
  if (!result.success && result.error === "fetch_error") {
    throw new RetryableError("Headers fetch failed", { retryAfter: "5s" });
  }

  return result;
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
