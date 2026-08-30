import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  push: vi.fn<(href: string, opts?: { scroll?: boolean }) => void | Promise<void>>(),
  back: vi.fn<() => void>(),
}));

const search = vi.hoisted(() => ({
  params: {} as Record<string, string>,
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push, back: nav.back }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => search.params[key] ?? null,
  }),
}));
vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("@/components/dashboard/add-domain/add-domain-content", () => ({
  AddDomainContent: ({
    onSuccess,
    onClose,
    isNavigating,
    resumeDomain,
    prefillDomain,
  }: {
    onSuccess: () => void;
    onClose?: () => void;
    isNavigating?: boolean;
    resumeDomain?: { id: string; domainName: string; verificationMethod: string | null } | null;
    prefillDomain?: string;
  }) => (
    <div>
      <span data-testid="resume">{JSON.stringify(resumeDomain ?? null)}</span>
      <span data-testid="prefill">{prefillDomain ?? ""}</span>
      <button type="button" onClick={onSuccess} disabled={isNavigating}>
        {isNavigating ? <span role="status" aria-label="Loading" /> : null}
        Finish
      </button>
      {onClose ? (
        <button type="button" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  ),
}));

import { AddDomainModalClient } from "@/components/dashboard/add-domain/add-domain-modal-client";
import { AddDomainPageClient } from "@/components/dashboard/add-domain/add-domain-page-client";
import { render, screen, waitFor } from "@/mocks/react";
import { DOMAINS_QUERY_KEY, SUBSCRIPTION_QUERY_KEY } from "@/mocks/trpc";

describe("AddDomainPageClient", () => {
  beforeEach(() => {
    search.params = {};
    nav.push.mockClear();
    nav.back.mockClear();
  });

  afterEach(() => {
    search.params = {};
  });

  it("parses resume params and returns to the dashboard after success", async () => {
    const user = userEvent.setup();
    search.params = {
      resume: "true",
      id: "domain-pending",
      domain: "pending.dev",
      method: "dns_txt",
    };
    const { queryClient } = render(<AddDomainPageClient prefillDomain="from-report.com" />);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    expect(JSON.parse(screen.getByTestId("resume").textContent ?? "null")).toEqual({
      id: "domain-pending",
      domainName: "pending.dev",
      verificationToken: "",
      verificationMethod: "dns_txt",
    });
    expect(screen.getByTestId("prefill")).toHaveTextContent("from-report.com");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: DOMAINS_QUERY_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: SUBSCRIPTION_QUERY_KEY });
    expect(nav.push).toHaveBeenCalledWith("/dashboard", { scroll: false });
    expect(nav.back).not.toHaveBeenCalled();
  });

  it("keeps the success action pending until dashboard navigation completes", async () => {
    const user = userEvent.setup();
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    render(<AddDomainPageClient />);

    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(nav.push).toHaveBeenCalledWith("/dashboard", { scroll: false });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
    });

    finishNavigation?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled());
  });

  it("starts a fresh add when resume params are incomplete", () => {
    search.params = { resume: "true", domain: "pending.dev" };
    render(<AddDomainPageClient />);
    expect(screen.getByTestId("resume")).toHaveTextContent("null");
  });
});

describe("AddDomainModalClient", () => {
  beforeEach(() => {
    search.params = {};
    nav.push.mockClear();
    nav.back.mockClear();
  });

  afterEach(() => {
    search.params = {};
  });

  it("goes back after success and invalidates lists", async () => {
    const user = userEvent.setup();
    const { queryClient } = render(<AddDomainModalClient />);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: DOMAINS_QUERY_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: SUBSCRIPTION_QUERY_KEY });
    expect(nav.back).toHaveBeenCalledOnce();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("goes back when the modal is closed", async () => {
    const user = userEvent.setup();
    render(<AddDomainModalClient />);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(nav.back).toHaveBeenCalledOnce();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
