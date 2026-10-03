import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: "",
  toastSuccess: vi.fn<(message: string, options?: { description?: string }) => void>(),
  toastError: vi.fn<(message: string, options?: { description?: string }) => void>(),
  captureException: vi.fn<(error: Error, properties?: Record<string, unknown>) => void>(),
  replaceState: vi.fn<(data: unknown, unused: string, url?: string | URL | null) => void>(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("posthog-js", () => ({
  default: { captureException: mocks.captureException },
}));

import { render } from "@/mocks/react";

import { useEmailChangeCallback } from "./use-email-change-callback";

function Harness() {
  useEmailChangeCallback();
  return null;
}

describe("useEmailChangeCallback", () => {
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

  it("toasts success once and strips the flag, keeping other params", async () => {
    mocks.search = "email_change=1&tab=x";
    await render(<Harness />);

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess.mock.calls[0]?.[0]).toBe("Email address updated");
    expect(mocks.toastError).not.toHaveBeenCalled();

    expect(mocks.replaceState).toHaveBeenCalledTimes(1);
    const url = new URL(String(mocks.replaceState.mock.calls[0]?.[2]), "http://localhost");
    expect([...url.searchParams.entries()]).toEqual([["tab", "x"]]);
  });

  it("toasts a failure for a known error code and strips all params", async () => {
    mocks.search = "email_change=1&error=TOKEN_EXPIRED";
    await render(<Harness />);

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError.mock.calls[0]?.[0]).toBe("Couldn't change your email");
    expect(mocks.toastError.mock.calls[0]?.[1]?.description).toContain("expired");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();

    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(mocks.captureException.mock.calls[0]?.[1]).toMatchObject({
      errorCode: "TOKEN_EXPIRED",
    });

    expect(mocks.replaceState).toHaveBeenCalledTimes(1);
    const url = new URL(String(mocks.replaceState.mock.calls[0]?.[2]), "http://localhost");
    expect(url.search).toBe("");
  });

  it("reports unknown error values as 'unknown' instead of the raw input", async () => {
    mocks.search = `email_change=1&error=${encodeURIComponent("<script>")}`;
    await render(<Harness />);

    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    const [err, props] = mocks.captureException.mock.calls[0] ?? [];
    expect(props).toMatchObject({ errorCode: "unknown" });
    expect(err?.message).not.toContain("<script>");
  });

  it("ignores error params without the email change flag", async () => {
    mocks.search = "error=access_denied";
    await render(<Harness />);

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.replaceState).not.toHaveBeenCalled();
  });

  it("does not toast again when re-rendered with the same params", async () => {
    mocks.search = "email_change=1";
    const screen = await render(<Harness />);
    await screen.rerender(<Harness />);

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
  });
});
