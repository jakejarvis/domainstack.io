import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const nav = vi.hoisted(() => ({
  pathname: "/login",
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/hooks/use-auth-callback", () => ({
  useAuthCallback: () => {},
}));
vi.mock("@domainstack/auth/client", () => ({
  useSession: () => ({ data: null, isPending: false }),
}));
vi.mock("@/lib/oauth", () => ({
  getEnabledProviders: () => [{ id: "github", name: "GitHub", icon: () => null, enabled: true }],
}));
// Render the callback URL so the test can observe what LoginContent passes down.
vi.mock("@/components/auth/oauth-button", () => ({
  OAuthButton: ({ callbackURL }: { callbackURL?: string }) => (
    <div data-testid="oauth" data-callback={callbackURL} />
  ),
}));
vi.mock("@/components/auth/dev-sign-in-form", () => ({
  DevSignInForm: () => null,
}));

import { LoginContent } from "@/components/auth/login-content";
import { render } from "@/mocks/react";

describe("LoginContent callback URL", () => {
  beforeEach(() => {
    nav.pathname = "/login";
    nav.search = "";
  });

  it("returns to a same-origin ?next= path after sign-in", async () => {
    nav.search = "next=/example.com";
    await render(<LoginContent />);

    await expect
      .element(page.getByTestId("oauth"))
      .toHaveAttribute("data-callback", "/example.com");
  });

  it("falls back to /dashboard for an off-site ?next= value", async () => {
    nav.search = "next=https://evil.com";
    await render(<LoginContent />);

    await expect.element(page.getByTestId("oauth")).toHaveAttribute("data-callback", "/dashboard");
  });

  it("falls back to /dashboard without ?next= on /login", async () => {
    await render(<LoginContent />);

    await expect.element(page.getByTestId("oauth")).toHaveAttribute("data-callback", "/dashboard");
  });

  it("prefers an explicit callbackURL over ?next=", async () => {
    nav.search = "next=/example.com";
    await render(<LoginContent callbackURL="/settings" />);

    await expect.element(page.getByTestId("oauth")).toHaveAttribute("data-callback", "/settings");
  });
});
