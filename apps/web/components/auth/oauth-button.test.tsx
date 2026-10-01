import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const auth = vi.hoisted(() => ({
  social: vi.fn<(opts: { provider: string }) => Promise<unknown>>(),
}));

vi.mock("@domainstack/auth/client", () => ({
  signIn: { social: auth.social },
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message?: string, opts?: { description?: string }) => void>(),
  },
}));

import { OAuthButton } from "@/components/auth/oauth-button";
import type { OAuthProviderConfig } from "@/lib/oauth";
import { render } from "@/mocks/react";

const github: OAuthProviderConfig = {
  id: "github",
  name: "GitHub",
  icon: () => null,
  enabled: true,
};

describe("OAuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets loading and toasts when Better Auth resolves a rate-limit error", async () => {
    auth.social.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests" },
    });
    const onLoadingChange = vi.fn<(loading: boolean) => void>();

    await render(<OAuthButton provider={github} onLoadingChange={onLoadingChange} />);
    await page.getByRole("button", { name: /Continue with GitHub/ }).click();

    await vi.waitFor(() => expect(onLoadingChange).toHaveBeenLastCalledWith(false));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Failed to sign in with GitHub.", {
      description: expect.stringContaining("Wait a few seconds"),
    });
  });

  it("keeps loading while navigating when sign-in succeeds", async () => {
    auth.social.mockResolvedValue({ data: { url: "https://github.com/login" }, error: null });
    const onLoadingChange = vi.fn<(loading: boolean) => void>();

    await render(<OAuthButton provider={github} onLoadingChange={onLoadingChange} />);
    await page.getByRole("button", { name: /Continue with GitHub/ }).click();

    await vi.waitFor(() => expect(auth.social).toHaveBeenCalledTimes(1));
    expect(onLoadingChange).toHaveBeenCalledWith(true);
    expect(onLoadingChange).not.toHaveBeenCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
