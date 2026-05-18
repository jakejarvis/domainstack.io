import { TRPCClientError } from "@trpc/client";

import { authClient } from "./auth";
import { toast } from "./toast";

function getTrpcErrorData(error: unknown): { code?: string; httpStatus?: number } | null {
  if (error instanceof TRPCClientError) {
    return (error.data as { code?: string; httpStatus?: number } | null) ?? null;
  }
  return null;
}

function getTrpcErrorCode(error: unknown): string | undefined {
  return getTrpcErrorData(error)?.code;
}

// Pre-tRPC layers (edge auth, gateway, CDN) can reject with a bare HTTP status
// that never gets a tRPC `code`. Fall back to the HTTP status so a transport
// 401/403/429 is still classified instead of being retried into oblivion.
function getTrpcHttpStatus(error: unknown): number | undefined {
  const status = getTrpcErrorData(error)?.httpStatus;
  return typeof status === "number" ? status : undefined;
}

function isUnauthorizedError(error: unknown): boolean {
  return getTrpcErrorCode(error) === "UNAUTHORIZED" || getTrpcHttpStatus(error) === 401;
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
  if (code !== undefined && NON_RETRYABLE_CODES.has(code)) return true;
  const status = getTrpcHttpStatus(error);
  return status !== undefined && status >= 400 && status < 500;
}

// The server attaches the authoritative wait time as `cause.retryAfter` and
// also embeds it in the message. Prefer the structured value, fall back to the
// message, then to a sane default — never leave the user without a number
// (the failure mode if the server message is ever reworded/localized).
const DEFAULT_RETRY_AFTER_SECONDS = 60;

function parseRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === "object") {
    const { retryAfter } = (error as { cause?: { retryAfter?: unknown } }).cause ?? {};
    if (typeof retryAfter === "number" && retryAfter > 0) return retryAfter;
  }
  if (error instanceof Error) {
    const match = error.message.match(/try again in (\d+)\s*s/i);
    if (match) {
      const seconds = Number.parseInt(match[1], 10);
      if (seconds > 0) return seconds;
    }
  }
  return DEFAULT_RETRY_AFTER_SECONDS;
}

// Stays true for the lifetime of the signed-out session. NOT reset when
// `signOut()` resolves: the post-resolution refetch storm from the persisted
// cache would otherwise fire a duplicate `signOut()` per stale 401. It is
// re-armed only when the active user actually changes (via `resetSignOutGuard`,
// called from `useResetCacheOnSignOut`) or when `signOut()` itself fails.
let signedOutForSession = false;

/** Re-arm the auto-sign-out guard once a user/session transition is observed. */
export function resetSignOutGuard(): void {
  signedOutForSession = false;
}
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
    if (!signedOutForSession) {
      signedOutForSession = true;
      void Promise.resolve(authClient.signOut()).catch(() => {
        // Sign-out failed (likely offline). Re-arm so a later attempt can
        // retry; the auth client clears local session state regardless.
        signedOutForSession = false;
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
        message: `Please wait ${retry} second${retry === 1 ? "" : "s"} before trying again.`,
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
