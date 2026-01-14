import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/mocks/react";
import { CertificatesSection, equalHostname } from "./certificates-section";

vi.mock("@/components/icons/provider-icon", () => ({
  ProviderIcon: ({
    providerId,
    providerDomain,
  }: {
    providerId: string;
    providerDomain: string | null;
  }) => (
    <div
      data-testid="provider-icon"
      data-slot="provider-icon"
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

vi.mock("@/components/ui/responsive-tooltip", () => ({
  ResponsiveTooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="responsive-tooltip">{children}</div>
  ),
  ResponsiveTooltipTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="responsive-tooltip-trigger">
      {render ?? children}
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
          caProvider: {
            id: "ca-letsencrypt",
            name: "Let's Encrypt",
            domain: "letsencrypt.org",
          },
        },
      ],
    };
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
    expect(await screen.findByText("*.test.invalid")).toBeInTheDocument();

    // Assert CA provider logo with correct domain
    const providerLogo = screen.getByTestId("provider-icon");
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
    expect(equalHostname(" TeSt.INVALID ", "test.invalid")).toBe(true);
  });
});
