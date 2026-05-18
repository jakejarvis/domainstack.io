import { TRPCClientError } from "@trpc/client";

import { authClient } from "./auth";
import { toast } from "./toast";

function getTrpcErrorCode(error: unknown): string | undefined {
  if (error instanceof TRPCClientError) {
    const data = error.data as { code?: string } | null | undefined;
    return data?.code;
  }
  return undefined;
}

function isUnauthorizedError(error: unknown): boolean {
  return getTrpcErrorCode(error) === "UNAUTHORIZED";
}

function isRateLimitError(error: unknown): boolean {
  if (getTrpcErrorCode(error) === "TOO_MANY_REQUESTS") return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return msg.includes("rate limit") || msg.includes("too many requests");
}

// Client/4xx-style tRPC codes that will never succeed on retry — retrying just
// delays the error (and, for UNAUTHORIZED, the sign-out) and hammers the API.
const NON_RETRYABLE_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "TOO_MANY_REQUESTS",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "UNPROCESSABLE_CONTENT",
  "PARSE_ERROR",
]);

export function isNonRetryableTrpcError(error: unknown): boolean {
  const code = getTrpcErrorCode(error);
  return code !== undefined && NON_RETRYABLE_CODES.has(code);
}

function parseRetryAfterSeconds(error: unknown): number | null {
  if (error instanceof Error) {
    const match = error.message.match(/try again in (\d+)\s*s/i);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}

let signingOut = false;
let lastRateLimitToastAt = 0;

/**
 * Centralized handling for the two cross-cutting tRPC failures:
 *
 *  - UNAUTHORIZED — the session is invalid/expired. Clear it ONCE so the app
 *    leaves the half-signed-in state (stale `useSession` user + generic
 *    "failed" toasts) and the `Stack.Protected` guards redirect. The
 *    active-user change is observed by `useResetCacheOnSignOut`, which wipes
 *    the cache and user-scoped stores.
 *  - TOO_MANY_REQUESTS — surface a friendly, deduped toast with retry timing
 *    instead of dumping the raw tRPC message.
 *
 * Returns `true` when it owned the user-facing feedback, so per-call error
 * handlers can skip their generic toast and avoid double toasts.
 */
export function handleCrossCuttingTrpcError(error: unknown): boolean {
  if (isUnauthorizedError(error)) {
    if (!signingOut) {
      signingOut = true;
      void Promise.resolve(authClient.signOut())
        .catch(() => {})
        .finally(() => {
          signingOut = false;
        });
    }
    return true;
  }

  if (isRateLimitError(error)) {
    const now = Date.now();
    // Dedupe: a batched/burst of rate-limited calls must not stack toasts.
    if (now - lastRateLimitToastAt > 3000) {
      lastRateLimitToastAt = now;
      const retry = parseRetryAfterSeconds(error);
      toast.error({
        title: "Too many requests",
        message:
          retry && retry > 0
            ? `Please wait ${retry} second${retry === 1 ? "" : "s"} before trying again.`
            : "Please wait a moment before trying again.",
      });
    }
    return true;
  }

  return false;
}

/**
 * Mutation `onError` helper: defers to the cross-cutting handler first
 * (UNAUTHORIZED / rate-limit), otherwise shows the operation-specific toast.
 */
export function toastMutationError(title: string, error: unknown): void {
  if (handleCrossCuttingTrpcError(error)) return;
  toast.error({
    title,
    message: error instanceof Error ? error.message : "Please try again.",
  });
}
