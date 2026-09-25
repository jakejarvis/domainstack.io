import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const session = vi.hoisted(() => ({
  data: null as { user: { id: string } } | null,
  isPending: false,
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
import { linkStatusMock } from "@/mocks/next-link";
import { render } from "@/mocks/react";
import { listDomainsQuery, resetTrpcMocks, setDomainsState } from "@/mocks/trpc";
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
    session.data = { user: { id: "user-1" } };
    session.isPending = false;
  });

  afterEach(() => {
    resetTrpcMocks();
    linkStatusMock.pending = false;
  });

  it("links to the add-domain flow for an untracked domain", async () => {
    setDomainsState([]);
    await renderButton();

    await expect
      .element(page.getByRole("button", { name: "Track domain" }))
      .toHaveAttribute("href", "/dashboard/add-domain?domain=example.com");
  });

  it("links to resume verification for an unverified domain", async () => {
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

    await expect
      .element(page.getByRole("button", { name: "Verify domain" }))
      .toHaveAttribute(
        "href",
        "/dashboard/add-domain?resume=true&id=domain-pending&method=dns_txt",
      );
  });

  it("links signed-out users to login", async () => {
    session.data = null;
    await renderButton();

    await expect
      .element(page.getByRole("button", { name: "Track domain" }))
      .toHaveAttribute("href", "/login");
  });

  it("swaps its icon for a spinner while the link navigates", async () => {
    linkStatusMock.pending = true;
    setDomainsState([]);
    await renderButton();

    const button = page.getByRole("button", { name: "Track domain" });
    await expect
      .element(button)
      .toHaveAttribute("href", "/dashboard/add-domain?domain=example.com");
    await expect.element(page.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    expect(button.elements()[0].querySelectorAll("svg")).toHaveLength(1);
  });

  it("shows the tracked-and-verified link for a verified domain", async () => {
    setDomainsState([
      makeTrackedDomain({
        domainName: "example.com",
        verified: true,
        verificationStatus: "verified",
      }),
    ]);

    await renderButton();

    await expect
      .element(page.getByRole("button", { name: "View in dashboard" }))
      .toBeInTheDocument();
    expect(listDomainsQuery).not.toHaveBeenCalled();
  });
});
