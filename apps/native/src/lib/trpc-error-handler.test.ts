/* @vitest-environment node */
import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authClient: { signOut: vi.fn<() => Promise<void>>(() => Promise.resolve()) },
}));
vi.mock("./toast", () => ({
  toast: { error: vi.fn<(opts: { title: string; message: string }) => void>() },
}));

import { authClient } from "./auth";
import { toast } from "./toast";
import {
  handleCrossCuttingTrpcError,
  isNonRetryableTrpcError,
  resetSignOutGuard,
} from "./trpc-error-handler";

function trpcError(opts: {
  message?: string;
  code?: string;
  httpStatus?: number;
  cause?: unknown;
}): TRPCClientError<never> {
  const err = new TRPCClientError<never>(opts.message ?? "error");
  Object.assign(err, {
    data: opts.code || opts.httpStatus ? { code: opts.code, httpStatus: opts.httpStatus } : null,
  });
  if (opts.cause !== undefined) Object.assign(err, { cause: opts.cause });
  return err;
}

const signOutMock = vi.mocked(authClient.signOut);
const toastMock = vi.mocked(toast.error);

// `lastRateLimitToastAt` is a module global with a 3s dedup window. Drive a
// monotonic absolute clock so each rate-limit assertion clears the window
// regardless of beforeEach reinstalling fake timers.
let clock = Date.UTC(2030, 0, 1);
function tickPastDedup(): void {
  clock += 3001;
  vi.setSystemTime(clock);
}

beforeEach(() => {
  vi.useFakeTimers();
  signOutMock.mockClear();
  toastMock.mockClear();
  resetSignOutGuard();
});

afterEach(() => {
  vi.useRealTimers();
});

// L4 — transport-level 4xx (no tRPC `code`) must still be non-retryable.
describe("isNonRetryableTrpcError", () => {
  it("is true for a tRPC client error code", () => {
    expect(isNonRetryableTrpcError(trpcError({ code: "FORBIDDEN" }))).toBe(true);
  });

  it("is true for a bare HTTP 4xx with no tRPC code", () => {
    expect(isNonRetryableTrpcError(trpcError({ httpStatus: 404 }))).toBe(true);
  });

  it("is false for 5xx (retryable) and non-tRPC errors", () => {
    expect(isNonRetryableTrpcError(trpcError({ httpStatus: 500 }))).toBe(false);
    expect(isNonRetryableTrpcError(new Error("network down"))).toBe(false);
  });
});

// L1 — wait-time hint prefers structured cause, then message, then a default.
// Advance past the 3s toast-dedup window before each call so it isn't swallowed.
describe("rate-limit retry hint", () => {
  it("uses the structured cause.retryAfter", () => {
    tickPastDedup();
    handleCrossCuttingTrpcError(
      trpcError({ code: "TOO_MANY_REQUESTS", message: "Rate limited", cause: { retryAfter: 42 } }),
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Please wait 42 seconds before trying again." }),
    );
  });

  it("falls back to the message, with singular grammar", () => {
    tickPastDedup();
    handleCrossCuttingTrpcError(
      trpcError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Try again in 1s" }),
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Please wait 1 second before trying again." }),
    );
  });

  it("falls back to a default when neither cause nor message carry a number", () => {
    tickPastDedup();
    handleCrossCuttingTrpcError(trpcError({ code: "TOO_MANY_REQUESTS", message: "Rate limited" }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Please wait 60 seconds before trying again." }),
    );
  });
});

// L3 — sign-out fires once per session, re-armed only on session change/failure.
describe("auto sign-out dedup", () => {
  it("signs out once across a burst of UNAUTHORIZED errors", () => {
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    handleCrossCuttingTrpcError(trpcError({ httpStatus: 401 }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("re-arms after resetSignOutGuard (new session transition)", () => {
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    resetSignOutGuard();
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });

  it("re-arms when signOut() rejects (offline)", async () => {
    signOutMock.mockRejectedValueOnce(new Error("offline"));
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    // Let the rejection's .catch re-arm the guard (microtasks, not timers).
    await Promise.resolve();
    await Promise.resolve();
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });
});
