import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: "",
  toastError: vi.fn<(message: string, options?: { description?: string }) => void>(),
  captureException: vi.fn<(error: Error, properties?: Record<string, unknown>) => void>(),
  replaceState: vi.fn<(data: unknown, unused: string, url?: string | URL | null) => void>(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));
vi.mock("posthog-js", () => ({
  default: { captureException: mocks.captureException },
}));

import { render } from "@/mocks/react";

import { useAuthCallback } from "./use-auth-callback";

function Harness({ context }: { context?: "sign_in" | "link" }) {
  useAuthCallback({ context });
  return null;
}

describe("useAuthCallback", () => {
  let restoreReplaceState: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
    // Swallow the real call so the test page URL isn't rewritten.
    const spy = vi.spyOn(window.history, "replaceState").mockImplementation(mocks.replaceState);
    restoreReplaceState = () => spy.mockRestore();
  });

  afterEach(() => {
    restoreReplaceState();
  });

  it("toasts once and strips error params without a client navigation", async () => {
    mocks.search = "next=/x&error=access_denied&error_description=foo";
    // App Router entries carry `__NA`, which makes Next skip its router sync.
    const stateSpy = vi.spyOn(window.history, "state", "get").mockReturnValue({ __NA: true });
    await render(<Harness />);
    stateSpy.mockRestore();

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError.mock.calls[0]?.[0]).toBe("Sign in failed");

    expect(mocks.replaceState).toHaveBeenCalledTimes(1);
    expect(mocks.replaceState.mock.calls[0]?.[0]).toBeNull();
    const url = new URL(String(mocks.replaceState.mock.calls[0]?.[2]), "http://localhost");
    expect([...url.searchParams.entries()]).toEqual([["next", "/x"]]);
  });

  it("titles the toast for linking in the link context", async () => {
    mocks.search = "error=access_denied";
    await render(<Harness context="link" />);

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError.mock.calls[0]?.[0]).toBe("Failed to link account");
  });

  it("reports unknown error values as 'unknown' instead of the raw input", async () => {
    mocks.search = `error=${encodeURIComponent("<script>")}`;
    await render(<Harness />);

    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    const [err, props] = mocks.captureException.mock.calls[0] ?? [];
    expect(props).toMatchObject({ errorCode: "unknown" });
    expect(err?.message).not.toContain("<script>");
  });

  it.each(["constructor", "__proto__", "valueOf", "toString", "hasOwnProperty"])(
    "uses the generic message for inherited property names (%s)",
    async (value) => {
      mocks.search = `error=${value}`;
      await render(<Harness />);

      expect(mocks.toastError.mock.calls[0]?.[1]).toEqual({
        description: "An error occurred during authentication. Please try again.",
      });
    },
  );

  it("passes a known code's own message", async () => {
    mocks.search = "error=access_denied";
    await render(<Harness />);

    const description = mocks.toastError.mock.calls[0]?.[1]?.description;
    expect(typeof description).toBe("string");
    expect(description).not.toBe("");
    expect(description).not.toBe("An error occurred during authentication. Please try again.");
  });

  it("does not toast again when re-rendered with the same params", async () => {
    mocks.search = "error=access_denied";
    const screen = await render(<Harness />);
    await screen.rerender(<Harness />);

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.replaceState).toHaveBeenCalledTimes(1);
  });

  it("steps aside for change-email callbacks", async () => {
    mocks.search = "email_change=1&error=TOKEN_EXPIRED";
    await render(<Harness />);

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.replaceState).not.toHaveBeenCalled();
  });

  it("titles the toast for a change-email link opened without a session", async () => {
    mocks.search = "error=email_change_sign_in_required";
    await render(<Harness />);

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError.mock.calls[0]?.[0]).toBe("Sign in to finish changing your email");
  });
});
