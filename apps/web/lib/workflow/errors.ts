import "server-only";
import { isExpectedDnsError } from "@domainstack/safe-fetch";
import { FatalError, RetryableError } from "workflow";
import { isExpectedTlsError } from "@/lib/tls-utils";

/**
 * Error codes from SafeFetchError that are permanent (should not retry)
 */
const PERMANENT_REMOTE_ASSET_ERRORS = new Set([
  "invalid_url",
  "protocol_not_allowed",
  "host_not_allowed",
  "host_blocked",
  "private_ip",
  "redirect_limit",
  "size_exceeded",
  "dns_error", // DNS errors from SafeFetchError are usually permanent (domain doesn't resolve)
]);

/**
 * Check if a SafeFetchError is permanent (should not retry)
 */
function isSafeFetchError(
  err: unknown,
): err is Error & { code?: string; name?: string } {
  return err instanceof Error && err.name === "SafeFetchError";
}

/**
 * Classify a fetch-related error into a workflow error.
 *
 * This utility helps steps properly signal to the workflow SDK whether
 * an error is retryable or fatal, based on the error type. It always
 * returns a classified error - either RetryableError or FatalError.
 *
 * @param err - The error to classify
 * @param options - Classification options
 * @returns RetryableError or FatalError based on error classification
 *
 * @example
 * ```ts
 * async function fetchDataStep(domain: string): Promise<Data> {
 *   "use step";
 *   try {
 *     return await fetchData(domain);
 *   } catch (err) {
 *     throw classifyFetchError(err, { context: `fetching ${domain}` });
 *   }
 * }
 * ```
 */
export function classifyFetchError(
  err: unknown,
  options: {
    /** Context string for error messages */
    context?: string;
    /** Delay before retry (default: "5s") */
    retryAfter?: string;
    /** Treat unknown errors as retryable (default: true) */
    retryUnknown?: boolean;
  } = {},
): RetryableError | FatalError {
  const { context = "fetch", retryAfter = "5s", retryUnknown = true } = options;

  // Preserve existing workflow errors - don't re-wrap them
  if (err instanceof FatalError || err instanceof RetryableError) {
    return err;
  }

  // DNS errors are usually permanent (domain doesn't exist)
  if (isExpectedDnsError(err)) {
    return new FatalError(`${context}: DNS resolution failed`);
  }

  // TLS errors are usually permanent (certificate issues)
  if (isExpectedTlsError(err)) {
    return new FatalError(`${context}: TLS/SSL error`);
  }

  // SafeFetchError has specific codes
  if (isSafeFetchError(err) && err.code) {
    if (PERMANENT_REMOTE_ASSET_ERRORS.has(err.code)) {
      return new FatalError(`${context}: ${err.code} - ${err.message}`);
    }
    // Other SafeFetchErrors (invalid_response, etc.) might be transient
    return new RetryableError(`${context}: ${err.code}`, {
      retryAfter: retryAfter as `${number}s`,
    });
  }

  // Check for HTTP errors with status codes
  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Rate limiting (429) - use longer retry delay
    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      // Try to extract Retry-After header value from error message
      // Many HTTP clients include this in the error
      const retryAfterMatch = message.match(/retry[- ]after[:\s]+(\d+)/i);
      const retrySeconds = retryAfterMatch
        ? Number.parseInt(retryAfterMatch[1], 10)
        : 60; // Default to 1 minute for rate limits
      return new RetryableError(`${context}: rate limited`, {
        retryAfter: `${retrySeconds}s` as `${number}s`,
      });
    }

    // Timeout errors are usually retryable
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("aborted")
    ) {
      return new RetryableError(`${context}: timeout`, {
        retryAfter: retryAfter as `${number}s`,
      });
    }

    // Network errors are usually retryable
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("socket hang up")
    ) {
      return new RetryableError(`${context}: network error`, {
        retryAfter: retryAfter as `${number}s`,
      });
    }
  }

  // Unknown errors - depends on configuration
  if (retryUnknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new RetryableError(`${context}: ${errorMessage}`, {
      retryAfter: retryAfter as `${number}s`,
    });
  }

  // Treat as fatal if retryUnknown is false
  const errorMessage = err instanceof Error ? err.message : String(err);
  return new FatalError(`${context}: ${errorMessage}`);
}

/**
 * Wrap an async operation with proper error classification for workflow steps.
 *
 * This is a convenience wrapper that catches errors and converts them to
 * appropriate workflow errors.
 *
 * @example
 * ```ts
 * async function fetchDataStep(domain: string): Promise<Data> {
 *   "use step";
 *   return await withFetchErrorHandling(
 *     () => fetchData(domain),
 *     { context: `fetching data for ${domain}` }
 *   );
 * }
 * ```
 */
export async function withFetchErrorHandling<T>(
  operation: () => Promise<T>,
  options: Parameters<typeof classifyFetchError>[1] = {},
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    throw classifyFetchError(err, options);
  }
}

/**
 * Error classification result for use in business logic.
 * Use this when you need to check the classification without throwing.
 */
export type ErrorClassification =
  | { type: "retryable"; reason: string; retryAfter?: string }
  | { type: "fatal"; reason: string }
  | { type: "rate_limited"; reason: string; retryAfter: string }
  | { type: "unknown" };

/**
 * Classify an error without throwing.
 *
 * Useful for business logic that needs to know the classification
 * to return appropriate result types.
 */
export function getErrorClassification(err: unknown): ErrorClassification {
  // Recognize existing workflow errors
  if (err instanceof FatalError) {
    return { type: "fatal", reason: "workflow_fatal" };
  }
  if (err instanceof RetryableError) {
    return { type: "retryable", reason: "workflow_retryable" };
  }

  if (isExpectedDnsError(err)) {
    return { type: "fatal", reason: "dns_error" };
  }

  if (isExpectedTlsError(err)) {
    return { type: "fatal", reason: "tls_error" };
  }

  if (isSafeFetchError(err) && err.code) {
    if (PERMANENT_REMOTE_ASSET_ERRORS.has(err.code)) {
      return { type: "fatal", reason: err.code };
    }
    // Other SafeFetchErrors (invalid_response, etc.) might be transient
    return { type: "retryable", reason: err.code };
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Rate limiting - special classification for observability
    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      // Try to extract retry-after
      const retryAfterMatch = message.match(/retry[- ]after[:\s]+(\d+)/i);
      const retryAfter = retryAfterMatch ? `${retryAfterMatch[1]}s` : "60s";
      return { type: "rate_limited", reason: "rate_limit", retryAfter };
    }

    // Timeout/abort errors (separate from network errors for semantic accuracy)
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("aborted")
    ) {
      return { type: "retryable", reason: "timeout" };
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("socket hang up")
    ) {
      return { type: "retryable", reason: "network" };
    }
  }

  return { type: "unknown" };
}

/**
 * Classify a database-related error into a workflow error.
 *
 * Database operations can fail transiently (connection timeouts, deadlocks,
 * temporary unavailability) and should be retried. This helper ensures
 * database errors are properly classified as retryable unless they're
 * clearly permanent (constraint violations, etc.).
 *
 * @param err - The error to classify
 * @param options - Classification options
 * @returns RetryableError or FatalError based on error classification
 *
 * @example
 * ```ts
 * async function persistDataStep(data: Data): Promise<void> {
 *   "use step";
 *   try {
 *     await db.insert(table).values(data);
 *   } catch (err) {
 *     throw classifyDatabaseError(err, { context: 'persisting data' });
 *   }
 * }
 * ```
 */
export function classifyDatabaseError(
  err: unknown,
  options: {
    /** Context string for error messages */
    context?: string;
    /** Delay before retry (default: "2s") */
    retryAfter?: string;
  } = {},
): RetryableError | FatalError {
  const { context = "database operation", retryAfter = "2s" } = options;

  // Preserve existing workflow errors
  if (err instanceof FatalError || err instanceof RetryableError) {
    return err;
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Connection/timeout errors are retryable
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("socket hang up")
    ) {
      return new RetryableError(`${context}: connection error`, {
        retryAfter: retryAfter as `${number}s`,
      });
    }

    // Deadlock errors are retryable
    if (message.includes("deadlock") || message.includes("lock timeout")) {
      return new RetryableError(`${context}: deadlock`, {
        retryAfter: "1s" as const, // Retry quickly for deadlocks
      });
    }

    // Constraint violations are usually fatal (bad data)
    if (
      message.includes("unique constraint") ||
      message.includes("foreign key constraint") ||
      message.includes("check constraint") ||
      message.includes("not null constraint")
    ) {
      return new FatalError(
        `${context}: constraint violation - ${err.message}`,
      );
    }

    // Syntax/schema errors are fatal
    if (
      message.includes("syntax error") ||
      message.includes("column") ||
      message.includes("relation") ||
      message.includes("does not exist")
    ) {
      return new FatalError(`${context}: schema error - ${err.message}`);
    }

    // Default: database errors are retryable
    return new RetryableError(`${context}: ${err.message}`, {
      retryAfter: retryAfter as `${number}s`,
    });
  }

  // Unknown errors default to retryable for database operations
  const errorMessage = err instanceof Error ? err.message : String(err);
  return new RetryableError(`${context}: ${errorMessage}`, {
    retryAfter: retryAfter as `${number}s`,
  });
}
