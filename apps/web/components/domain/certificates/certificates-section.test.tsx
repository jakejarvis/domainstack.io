import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";
import type { Certificate, CertificatesResponse } from "@domainstack/types";

import { CertificatesSection, equalHostname } from "./certificates-section";

function cert(
  overrides: Partial<Certificate> & Pick<Certificate, "issuer" | "subject">,
): Certificate {
  return {
    altNames: [],
    validFrom: "2024-01-01T00:00:00.000Z",
    validTo: "2025-01-01T00:00:00.000Z",
    fingerprint256: null,
    serialNumber: null,
    chainPosition: 0,
    caProvider: { id: null, name: null, domain: null },
    ...overrides,
  };
}

function response(
  certificates: Certificate[],
  overrides: Partial<CertificatesResponse> = {},
): CertificatesResponse {
  return {
    certificates,
    valid: true,
    validationError: null,
    protocol: "TLSv1.3",
    cipher: "TLS_AES_256_GCM_SHA384",
    publicKeyBits: 256,
    chainComplete: true,
    ...overrides,
  };
}

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
    const data = response([
      cert({
        issuer: "Let's Encrypt",
        subject: "test.invalid",
        altNames: ["*.test.invalid", "test.invalid"],
        caProvider: {
          id: "ca-letsencrypt",
          name: "Let's Encrypt",
          domain: "letsencrypt.org",
        },
      }),
    ]);
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

  it("does not show an invalid-certificate alert when the chain is trusted", async () => {
    await render(
      <CertificatesSection
        data={response([cert({ issuer: "Let's Encrypt", subject: "test.invalid" })])}
      />,
    );
    await expect
      .element(page.getByText("Invalid certificate", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Certificate expired", { exact: true }))
      .not.toBeInTheDocument();
  });

  it("shows empty state when no certificates", async () => {
    await render(<CertificatesSection data={null} />);
    await expect.element(page.getByText(/No certificates found/i)).toBeInTheDocument();
  });

  it("shows the invalid-certificate alert when an error is present without a chain", async () => {
    await render(
      <CertificatesSection
        data={response([], {
          valid: false,
          error: "tls_error",
        })}
      />,
    );

    await expect
      .element(page.getByText("Invalid certificate", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText("tls_error", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText(/No certificates found/i)).toBeInTheDocument();
  });

  it("keeps invalid certificates inspectable and explains the failure", async () => {
    await render(
      <CertificatesSection
        data={response([cert({ issuer: "Let's Encrypt", subject: "test.invalid" })], {
          valid: false,
          validationError: "CERT_HAS_EXPIRED",
        })}
      />,
    );

    await expect
      .element(page.getByText("Certificate expired", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText("CERT_HAS_EXPIRED", { exact: true })).toBeInTheDocument();
    expect(
      page
        .getByText("test.invalid", { exact: true })
        .elements()
        .some((n) => n.tagName.toLowerCase() === "span"),
    ).toBe(true);
    await expect.element(page.getByText("Issuer", { exact: true })).toBeInTheDocument();
  });

  it("explains hostname mismatches distinctly", async () => {
    await render(
      <CertificatesSection
        data={response([cert({ issuer: "Let's Encrypt", subject: "other.example" })], {
          valid: false,
          validationError: "ERR_TLS_CERT_ALTNAME_INVALID",
        })}
      />,
    );

    await expect.element(page.getByText("Hostname mismatch", { exact: true })).toBeInTheDocument();
    expect(
      page
        .getByText("other.example", { exact: true })
        .elements()
        .some((n) => n.tagName.toLowerCase() === "span"),
    ).toBe(true);
  });

  it("expands and collapses the rest of the certificate chain", async () => {
    const data = response([
      cert({
        issuer: "Let's Encrypt",
        subject: "test.invalid",
        altNames: ["test.invalid"],
        caProvider: {
          id: "ca-letsencrypt",
          name: "Let's Encrypt",
          domain: "letsencrypt.org",
        },
      }),
      cert({
        issuer: "ISRG Root X1",
        subject: "R3",
        chainPosition: 1,
        caProvider: {
          id: "ca-isrg",
          name: "ISRG",
          domain: "letsencrypt.org",
        },
      }),
    ]);
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
