/* @vitest-environment node */
import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authClient: { signOut: vi.fn<() => Promise<void>>(() => Promise.resolve()) },
  getAuthCookieHeader: vi.fn<() => string | null>(),
}));
vi.mock("./toast", () => ({
  toast: { error: vi.fn<(opts: { title: string; message: string }) => void>() },
}));

import { authClient, getAuthCookieHeader } from "./auth";
import { OfflineError } from "./network";
import { toast } from "./toast";
import { handleCrossCuttingTrpcError, isNonRetryableTrpcError } from "./trpc-error-handler";

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
const cookieMock = vi.mocked(getAuthCookieHeader);

// The sign-out guard is keyed by the session cookie with no reset hook, so
// give every test a distinct default cookie — module state can't bleed across
// tests, and a test that needs a transition overrides this explicitly.
let testCookieSeq = 0;

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
  cookieMock.mockReset();
  cookieMock.mockReturnValue(`cookie-${testCookieSeq++}`);
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

// Offline bail-out owns the user feedback (one friendly toast, deduped) so the
// per-mutation handler skips its "<Action> failed" message and no sign-out fires.
describe("offline guard", () => {
  it("shows one friendly offline toast and owns the feedback", () => {
    tickPastDedup();
    const handled = handleCrossCuttingTrpcError(new OfflineError());
    expect(handled).toBe(true);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "You’re offline" }));
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("dedupes a burst within the 3s window", () => {
    tickPastDedup();
    handleCrossCuttingTrpcError(new OfflineError());
    handleCrossCuttingTrpcError(new OfflineError());
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});

// L3 — sign-out fires once per session cookie; the cookie identity is the
// guard's epoch (no external reset hook).
describe("auto sign-out dedup", () => {
  // Literals are unique per test: the guard is module-level with no reset, so
  // reusing a value across tests would let one test's marker dedupe another's.
  it("signs out once across a burst of UNAUTHORIZED errors for one session", () => {
    cookieMock.mockReturnValue("burst-session");
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    handleCrossCuttingTrpcError(trpcError({ httpStatus: 401 }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("signs out again when the session cookie changes (re-sign-in)", () => {
    cookieMock.mockReturnValue("change-session-a");
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    cookieMock.mockReturnValue("change-session-b");
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });

  it("does not sign out when there is no session cookie (post-sign-out storm)", () => {
    cookieMock.mockReturnValue(null);
    const handled = handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(handled).toBe(true);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("re-arms for the same session when signOut() rejects (offline)", async () => {
    cookieMock.mockReturnValue("session-x");
    signOutMock.mockRejectedValueOnce(new Error("offline"));
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    // Let the rejection's .catch re-arm the marker (microtasks, not timers).
    await Promise.resolve();
    await Promise.resolve();
    handleCrossCuttingTrpcError(trpcError({ code: "UNAUTHORIZED" }));
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });
});
