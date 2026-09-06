import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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
import { render } from "@/mocks/react";

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
    search.params = {
      resume: "true",
      id: "domain-pending",
      domain: "pending.dev",
      method: "dns_txt",
    };
    await render(<AddDomainPageClient prefillDomain="from-report.com" />);

    expect(JSON.parse(page.getByTestId("resume").element().textContent ?? "null")).toEqual({
      id: "domain-pending",
      domainName: "pending.dev",
      verificationToken: "",
      verificationMethod: "dns_txt",
    });
    await expect.element(page.getByTestId("prefill")).toHaveTextContent("from-report.com");
    await expect.element(page.getByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Finish" }).click();

    expect(nav.push).toHaveBeenCalledWith("/dashboard", { scroll: false });
    expect(nav.back).not.toHaveBeenCalled();
  });

  it("keeps the success action pending until dashboard navigation completes", async () => {
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    await render(<AddDomainPageClient />);

    await page.getByRole("button", { name: "Finish" }).click();

    expect(nav.push).toHaveBeenCalledWith("/dashboard", { scroll: false });
    await expect.element(page.getByRole("button", { name: /loading/i })).toBeDisabled();

    finishNavigation?.();
    await expect.element(page.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("starts a fresh add when resume params are incomplete", async () => {
    search.params = { resume: "true", domain: "pending.dev" };
    await render(<AddDomainPageClient />);
    await expect.element(page.getByTestId("resume")).toHaveTextContent("null");
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

  it("goes back after success", async () => {
    await render(<AddDomainModalClient />);

    await page.getByRole("button", { name: "Finish" }).click();

    expect(nav.back).toHaveBeenCalledOnce();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("goes back when the modal is closed", async () => {
    await render(<AddDomainModalClient />);

    await page.getByRole("button", { name: "Close" }).click();

    expect(nav.back).toHaveBeenCalledOnce();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
