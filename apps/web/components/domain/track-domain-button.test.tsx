import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { render, screen, waitFor } from "@/mocks/react";
import { resetTrpcMocks, setDomainsState } from "@/mocks/trpc";
import { TooltipProvider } from "@domainstack/ui/tooltip";

function renderButton(domain = "example.com") {
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
    renderButton();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Track domain" })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: "Track domain" }));

    expect(nav.push).toHaveBeenCalledWith("/dashboard/add-domain?domain=example.com", {
      scroll: false,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Track domain" })).toBeDisabled();
      expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    });

    finishNavigation?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "Track domain" })).toBeEnabled());
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
    renderButton();

    const button = await screen.findByRole("button", { name: "Verify domain" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(nav.push).toHaveBeenCalledWith(
      "/dashboard/add-domain?resume=true&id=domain-pending&method=dns_txt",
      { scroll: false },
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Verify domain" })).toBeDisabled();
      expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    });

    finishNavigation?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verify domain" })).toBeEnabled(),
    );
  });
});
