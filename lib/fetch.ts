import { type TimeoutAndRetryOptions, withTimeoutAndRetry } from "@/lib/async";
import { USER_AGENT } from "@/lib/constants/app";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "fetch" });

/**
 * Options for fetch with timeout and retry behavior.
 * @deprecated Use TimeoutAndRetryOptions from @/lib/async for new code.
 */
export interface FetchOptions {
  /** Abort timeout per request (ms). */
  timeoutMs?: number;
  /** Number of retry attempts (defaults to 0). */
  retries?: number;
  /** Backoff delay multiplier for retries (ms). */
  backoffMs?: number;
}

/**
 * Fetch a trusted upstream resource with a timeout and optional retries.
 *
 * This is a convenience wrapper around the more flexible `withTimeoutAndRetry`
 * utility. For new code, consider using `withTimeoutAndRetry` directly for
 * more control over retry behavior.
 *
 * Do not use this for user-controlled URLs; prefer the hardened `safeFetch` helper.
 *
 * @example
 * ```ts
 * const response = await fetchWithTimeoutAndRetry(
 *   "https://api.example.com/data",
 *   { headers: { Authorization: "Bearer token" } },
 *   { timeoutMs: 5000, retries: 2 }
 * );
 * ```
 */
export async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: FetchOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retries = Math.max(0, opts.retries ?? 0);
  const delayMs = Math.max(0, opts.backoffMs ?? 150);
  const externalSignal = init.signal ?? undefined;

  const options: TimeoutAndRetryOptions = {
    timeoutMs,
    retries,
    delayMs,
    backoffMultiplier: 1, // Linear backoff to match original behavior
    signal: externalSignal,
    onRetry: (err, attempt) => {
      logger.warn(
        { err, url: input instanceof Request ? input.url : String(input) },
        `fetch failed, retrying (attempt ${attempt + 1}/${retries + 1})`,
      );
    },
  };

  return withTimeoutAndRetry(async (signal) => {
    // Robust header merging that handles Headers instances, objects, and undefined
    const headers = new Headers(init.headers ?? undefined);
    headers.set("User-Agent", USER_AGENT);

    return fetch(input, {
      ...init,
      signal,
      headers,
    });
  }, options);
}

// Re-export the new utilities for convenience
export {
  type RetryOptions,
  type TimeoutAndRetryOptions,
  type TimeoutOptions,
  withRetry,
  withTimeout,
  withTimeoutAndRetry as withTimeoutAndRetryAsync,
} from "@/lib/async";
