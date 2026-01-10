import "server-only";
import { FatalError, RetryableError } from "workflow";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { isExpectedTlsError } from "@/lib/tls-utils";

/**
 * Error codes from RemoteAssetError that are permanent (should not retry)
 */
const PERMANENT_REMOTE_ASSET_ERRORS = new Set([
  "invalid_url",
  "protocol_not_allowed",
  "host_not_allowed",
  "host_blocked",
  "private_ip",
  "redirect_limit",
  "size_exceeded",
  "dns_error", // DNS errors from RemoteAssetError are usually permanent (domain doesn't resolve)
]);

/**
 * Check if a RemoteAssetError is permanent (should not retry)
 */
function isRemoteAssetError(
  err: unknown,
): err is Error & { code?: string; name?: string } {
  return err instanceof Error && err.name === "RemoteAssetError";
}

/**
 * Classify a fetch-related error into a workflow error.
 *
 * This utility helps steps properly signal to the workflow SDK whether
 * an error is retryable or fatal, based on the error type.
 *
 * @param err - The error to classify
 * @param options - Classification options
 * @returns RetryableError, FatalError, or undefined if the error should be re-thrown
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

  // DNS errors are usually permanent (domain doesn't exist)
  if (isExpectedDnsError(err)) {
    return new FatalError(`${context}: DNS resolution failed`);
  }

  // TLS errors are usually permanent (certificate issues)
  if (isExpectedTlsError(err)) {
    return new FatalError(`${context}: TLS/SSL error`);
  }

  // RemoteAssetError has specific codes
  if (isRemoteAssetError(err) && err.code) {
    if (PERMANENT_REMOTE_ASSET_ERRORS.has(err.code)) {
      return new FatalError(`${context}: ${err.code} - ${err.message}`);
    }
    // Other RemoteAssetErrors (invalid_response, etc.) might be transient
    return new RetryableError(`${context}: ${err.code}`, {
      retryAfter: retryAfter as `${number}s`,
    });
  }

  // Timeout errors are usually retryable
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
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
  | { type: "retryable"; reason: string }
  | { type: "fatal"; reason: string }
  | { type: "unknown" };

/**
 * Classify an error without throwing.
 *
 * Useful for business logic that needs to know the classification
 * to return appropriate result types.
 */
export function getErrorClassification(err: unknown): ErrorClassification {
  if (isExpectedDnsError(err)) {
    return { type: "fatal", reason: "dns_error" };
  }

  if (isExpectedTlsError(err)) {
    return { type: "fatal", reason: "tls_error" };
  }

  if (isRemoteAssetError(err) && err.code) {
    if (PERMANENT_REMOTE_ASSET_ERRORS.has(err.code)) {
      return { type: "fatal", reason: err.code };
    }
    // Other RemoteAssetErrors (invalid_response, etc.) might be transient
    return { type: "retryable", reason: err.code };
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();

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
