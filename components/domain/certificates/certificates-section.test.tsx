/* @vitest-environment jsdom */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/lib/test-utils";
import { CertificatesSection, equalHostname } from "./certificates-section";

vi.mock("@/components/domain/provider-logo", () => ({
  ProviderLogo: ({
    providerId,
    providerDomain,
  }: {
    providerId: string;
    providerDomain: string | null;
  }) => (
    <div
      data-testid="provider-logo"
      data-slot="provider-logo"
      data-provider-id={providerId}
      data-provider-domain={providerDomain}
    />
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="tooltip-trigger">
      {render ?? children}
    </button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip-content">{children}</div>
  ),
}));

describe("CertificatesSection", () => {
  it("renders certificate fields and SAN count", async () => {
    const data = [
      {
        issuer: "Let's Encrypt",
        subject: "example.com",
        altNames: ["*.example.com", "example.com"],
        validFrom: "2024-01-01T00:00:00.000Z",
        validTo: "2025-01-01T00:00:00.000Z",
        caProvider: {
          id: "ca-letsencrypt",
          name: "Let's Encrypt",
          domain: "letsencrypt.org",
        },
      },
    ];
    render(<CertificatesSection data={data} />);
    expect(screen.getByText("Issuer")).toBeInTheDocument();
    expect(
      screen
        .getAllByText("Let's Encrypt")
        .some((n) => n.tagName.toLowerCase() === "span"),
    ).toBe(true);
    expect(screen.getByText("Subject")).toBeInTheDocument();

    // Assert SAN count badge - altNames has 2 items but "example.com" matches subject, so +1
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    // Assert tooltip wrapper and content with SAN domains
    expect(screen.getByRole("button", { name: /\+1/i })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /\+1/i }));
    expect(await screen.findByText("*.example.com")).toBeInTheDocument();

    // Assert CA provider logo with correct domain
    const providerLogo = screen.getByTestId("provider-logo");
    expect(providerLogo).toHaveAttribute("data-provider-id", "ca-letsencrypt");
    expect(providerLogo).toHaveAttribute(
      "data-provider-domain",
      "letsencrypt.org",
    );

    // Assert CA provider name displayed as annotation
    const caProviderName = screen
      .getAllByText("Let's Encrypt")
      .find((n) => n.className.includes("text-[11px]"));
    expect(caProviderName).toBeInTheDocument();
  });

  it("shows empty state when no certificates", () => {
    render(<CertificatesSection data={null} />);
    expect(screen.getByText(/No certificates found/i)).toBeInTheDocument();
  });
});

describe("equalHostname", () => {
  it("ignores case and whitespace", () => {
    expect(equalHostname(" ExAmple.COM ", "example.com")).toBe(true);
  });
});
