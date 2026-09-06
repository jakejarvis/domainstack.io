import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const nav = vi.hoisted(() => ({
  push: vi.fn<(href: string, opts?: { scroll?: boolean }) => void | Promise<void>>(),
}));

const session = vi.hoisted(() => ({
  data: null as { user: { id: string } } | null,
  isPending: false,
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));
vi.mock("@domainstack/auth/client", () => ({
  useSession: () => session,
}));
vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});

import { makeTrackedDomain } from "@/components/dashboard/test-fixtures";
import { TrackDomainButton } from "@/components/domain/track-domain-button";
import { render } from "@/mocks/react";
import { resetTrpcMocks, setDomainsState } from "@/mocks/trpc";
import { TooltipProvider } from "@domainstack/ui/tooltip";

async function renderButton(domain = "example.com") {
  return render(
    <TooltipProvider>
      <TrackDomainButton domain={domain} />
    </TooltipProvider>,
  );
}

describe("TrackDomainButton", () => {
  beforeEach(() => {
    resetTrpcMocks();
    nav.push.mockReset();
    session.data = { user: { id: "user-1" } };
    session.isPending = false;
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("shows a pending state while navigating to add a domain", async () => {
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    setDomainsState([]);
    await renderButton();

    await expect.element(page.getByRole("button", { name: "Track domain" })).toBeEnabled();
    await page.getByRole("button", { name: "Track domain" }).click();

    expect(nav.push).toHaveBeenCalledWith("/dashboard/add-domain?domain=example.com", {
      scroll: false,
    });
    await vi.waitFor(async () => {
      const button = page.getByRole("button", { name: "Track domain" });
      await expect.element(button).toBeDisabled();
      await expect.element(page.getByRole("status", { name: /loading/i })).toBeInTheDocument();
      expect(button.elements()[0].querySelectorAll("svg")).toHaveLength(1);
    });

    finishNavigation?.();
    await expect.element(page.getByRole("button", { name: "Track domain" })).toBeEnabled();
  });

  it("shows a pending state while resuming verification", async () => {
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    setDomainsState([
      makeTrackedDomain({
        id: "domain-pending",
        domainName: "example.com",
        verified: false,
        verificationMethod: "dns_txt",
        verificationStatus: "unverified",
      }),
    ]);
    await renderButton();

    await expect.element(page.getByRole("button", { name: "Verify domain" })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Verify domain" })).toBeEnabled();
    await page.getByRole("button", { name: "Verify domain" }).click();

    expect(nav.push).toHaveBeenCalledWith(
      "/dashboard/add-domain?resume=true&id=domain-pending&method=dns_txt",
      { scroll: false },
    );
    await vi.waitFor(async () => {
      const pendingButton = page.getByRole("button", { name: "Verify domain" });
      await expect.element(pendingButton).toBeDisabled();
      await expect.element(page.getByRole("status", { name: /loading/i })).toBeInTheDocument();
      expect(pendingButton.elements()[0].querySelectorAll("svg")).toHaveLength(1);
    });

    finishNavigation?.();
    await expect.element(page.getByRole("button", { name: "Verify domain" })).toBeEnabled();
  });
});
