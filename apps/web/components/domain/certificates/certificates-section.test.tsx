import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { CertificatesSection, equalHostname } from "./certificates-section";

vi.mock("@/components/icons/provider-logo", () => ({
  ProviderLogo: ({ providerId }: { providerId: string }) => (
    <div data-testid="provider-logo" data-slot="provider-logo" data-provider-id={providerId} />
  ),
}));

vi.mock("@domainstack/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="tooltip-trigger">
      {renderProp ?? children}
    </button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip-content">{children}</div>
  ),
}));

vi.mock("@domainstack/ui/responsive-tooltip", () => ({
  ResponsiveTooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="responsive-tooltip">{children}</div>
  ),
  ResponsiveTooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="responsive-tooltip-trigger">
      {renderProp ?? children}
    </button>
  ),
  ResponsiveTooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="responsive-tooltip-content">{children}</div>
  ),
}));

describe("CertificatesSection", () => {
  it("renders certificate fields and SAN count", async () => {
    const data = {
      certificates: [
        {
          issuer: "Let's Encrypt",
          subject: "test.invalid",
          altNames: ["*.test.invalid", "test.invalid"],
          validFrom: "2024-01-01T00:00:00.000Z",
          validTo: "2025-01-01T00:00:00.000Z",
          fingerprint256: null,
          serialNumber: null,
          caProvider: {
            id: "ca-letsencrypt",
            name: "Let's Encrypt",
            domain: "letsencrypt.org",
          },
        },
      ],
    };
    await render(<CertificatesSection data={data} />);
    await expect.element(page.getByText("Issuer", { exact: true })).toBeInTheDocument();
    expect(
      page
        .getByText("Let's Encrypt", { exact: true })
        .elements()
        .some((n) => n.tagName.toLowerCase() === "span"),
    ).toBe(true);
    await expect.element(page.getByText("Subject", { exact: true })).toBeInTheDocument();

    // Assert SAN count badge - altNames has 2 items but "example.com" matches subject, so +1
    await expect.element(page.getByText("+", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("1", { exact: true })).toBeInTheDocument();

    // Assert tooltip wrapper and content with SAN domains
    await expect.element(page.getByRole("button", { name: /\+\s*1/ })).toBeInTheDocument();
    await page.getByRole("button", { name: /\+\s*1/ }).click();
    await expect.element(page.getByText("*.test.invalid", { exact: true })).toBeInTheDocument();

    // Assert CA provider logo
    await expect
      .element(page.getByTestId("provider-logo"))
      .toHaveAttribute("data-provider-id", "ca-letsencrypt");

    // Assert CA provider name displayed as annotation
    const caProviderName = page
      .getByText("Let's Encrypt", { exact: true })
      .elements()
      .find((n) => n.className.includes("text-[11px]"));
    expect(caProviderName).toBeDefined();
  });

  it("shows empty state when no certificates", async () => {
    await render(<CertificatesSection data={null} />);
    await expect.element(page.getByText(/No certificates found/i)).toBeInTheDocument();
  });

  it("expands and collapses the rest of the certificate chain", async () => {
    const data = {
      certificates: [
        {
          issuer: "Let's Encrypt",
          subject: "test.invalid",
          altNames: ["test.invalid"],
          validFrom: "2024-01-01T00:00:00.000Z",
          validTo: "2025-01-01T00:00:00.000Z",
          fingerprint256: null,
          serialNumber: null,
          caProvider: {
            id: "ca-letsencrypt",
            name: "Let's Encrypt",
            domain: "letsencrypt.org",
          },
        },
        {
          issuer: "ISRG Root X1",
          subject: "R3",
          altNames: [],
          validFrom: "2020-01-01T00:00:00.000Z",
          validTo: "2025-09-01T00:00:00.000Z",
          fingerprint256: null,
          serialNumber: null,
          caProvider: {
            id: "ca-isrg",
            name: "ISRG",
            domain: "letsencrypt.org",
          },
        },
      ],
    };
    await render(<CertificatesSection data={data} />);

    // Subject appears as both the truncated label and tooltip content
    const chainSubject = () =>
      page
        .getByText("R3", { exact: true })
        .elements()
        .find((node) => node.tagName.toLowerCase() === "span");

    await expect
      .element(page.getByRole("button", { name: "Show Chain" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(chainSubject()?.closest("[inert]")).not.toBeNull();
    expect(chainSubject()?.closest('[aria-hidden="true"]')).not.toBeNull();

    await page.getByRole("button", { name: "Show Chain" }).click();

    expect(chainSubject()?.closest("[inert]")).toBeNull();
    expect(chainSubject()?.closest('[aria-hidden="true"]')).toBeNull();
    await expect
      .element(page.getByRole("button", { name: "Hide Chain" }))
      .toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Hide Chain" }).click();

    await expect.element(page.getByRole("button", { name: "Show Chain" })).toBeInTheDocument();
    expect(chainSubject()?.closest("[inert]")).not.toBeNull();
    expect(chainSubject()?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("equalHostname", () => {
  it("ignores case and whitespace", () => {
    expect(equalHostname(" TeSt.INVALID ", "test.invalid")).toBe(true);
  });
});
