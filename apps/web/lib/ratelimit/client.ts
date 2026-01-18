import { SpeedometerIcon } from "@phosphor-icons/react/dist/ssr";
import { createElement } from "react";
import { toast } from "sonner";

/**
 * Rate limit error details extracted from tRPC or API errors.
 */
export type RateLimitError = {
  /** Seconds until the rate limit resets */
  retryAfter: number;
  /** Human-readable message */
  message: string;
};

/**
 * Check if an error is a rate limit error (tRPC TOO_MANY_REQUESTS or HTTP 429).
 *
 * Works with:
 * - tRPC errors with code "TOO_MANY_REQUESTS"
 * - Fetch Response objects with status 429
 * - Error objects with message containing rate limit indicators
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;

  // Check for fetch Response with status 429
  if (error instanceof Response) {
    return error.status === 429;
  }

  // tRPC error shape
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    // Check tRPC error code
    if (err.data && typeof err.data === "object") {
      const data = err.data as Record<string, unknown>;
      if (data.code === "TOO_MANY_REQUESTS") return true;
    }

    // Check for TRPCClientError shape
    if (err.code === "TOO_MANY_REQUESTS") return true;

    // Check message
    if (typeof err.message === "string") {
      const msg = err.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many requests")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract rate limit details from an error.
 *
 * Parses retry timing from:
 * - tRPC error message: "Rate limit exceeded. Try again in 30s"
 * - Error cause with retryAfter property
 * - Falls back to 60 seconds if unparseable
 */
export function extractRateLimitError(error: unknown): RateLimitError | null {
  if (!isRateLimitError(error)) return null;

  let retryAfter = 60; // Default fallback
  let message = "Too many requests. Please try again later.";

  if (typeof error === "object" && error !== null) {
    const { message: errMessage, cause: errCause } = error as Record<
      string,
      unknown
    >;

    // Extract message
    if (typeof errMessage === "string") {
      message = errMessage;

      // Parse "Try again in Ns" pattern from tRPC errors
      const match = errMessage.match(/try again in (\d+)s/i);
      if (match) {
        retryAfter = Number.parseInt(match[1], 10);
      }
    }

    // Check cause for structured retry info
    if (errCause && typeof errCause === "object") {
      const { retryAfter: causeRetryAfter } = errCause as Record<
        string,
        unknown
      >;
      if (typeof causeRetryAfter === "number") {
        retryAfter = causeRetryAfter;
      }
    }
  }

  return { retryAfter, message };
}

/**
 * Show a toast notification for rate limit errors.
 *
 * Displays user-friendly message with countdown.
 * Returns true if a toast was shown (error was rate-limit related).
 *
 * @example
 * ```ts
 * onError: (error) => {
 *   if (!showRateLimitToast(error)) {
 *     toast.error("Something went wrong");
 *   }
 * }
 * ```
 */
export function showRateLimitToast(error: unknown): boolean {
  const rateLimitError = extractRateLimitError(error);
  if (!rateLimitError) return false;

  const { retryAfter } = rateLimitError;

  toast.error("Too many requests", {
    description:
      retryAfter > 0
        ? `Please wait ${retryAfter} second${retryAfter !== 1 ? "s" : ""} before trying again.`
        : "Please wait a moment before trying again.",
    icon: createElement(SpeedometerIcon, { className: "size-4" }),
  });

  return true;
}

/**
 * Parse Retry-After header from a rate-limited response.
 * Returns seconds to wait before retrying.
 *
 * @param response - Fetch Response object (typically with status 429)
 * @param defaultSeconds - Fallback value if header is missing/invalid (default: 60)
 */
export function parseRetryAfterHeader(
  response: Response,
  defaultSeconds = 60,
): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number.parseInt(header, 10);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return seconds;
    }
  }
  return defaultSeconds;
}
