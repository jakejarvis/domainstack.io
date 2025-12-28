import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/mocks/react";
import { HostingSection } from "./hosting-section";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  // biome-ignore lint/suspicious/noExplicitAny: fine for this test
  default: (_loader: any, _opts: any) => {
    // return a dummy component to avoid map rendering
    return () => <div data-slot="hosting-map" />;
  },
}));

vi.mock("@/components/domain/provider-logo", () => ({
  ProviderLogo: ({
    providerId: _providerId,
    providerDomain,
  }: {
    providerId: string | null | undefined;
    providerDomain: string | null;
  }) => <div>logo:{providerDomain}</div>,
}));

describe("HostingSection", () => {
  it("renders provider names and icons", () => {
    const data = {
      dnsProvider: {
        id: "provider-cloudflare",
        name: "Cloudflare",
        domain: "cloudflare.com",
      },
      hostingProvider: {
        id: "provider-vercel",
        name: "Vercel",
        domain: "vercel.com",
      },
      emailProvider: {
        id: "provider-google",
        name: "Google Workspace",
        domain: "google.com",
      },
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
    } as unknown as import("@/lib/schemas").HostingResponse;
    render(<HostingSection data={data} />);
    expect(screen.getByText("Cloudflare")).toBeInTheDocument();
    expect(screen.getByText(/logo:cloudflare.com/)).toBeInTheDocument();
    expect(screen.getByText("Vercel")).toBeInTheDocument();
    expect(screen.getByText("Google Workspace")).toBeInTheDocument();
  });

  it("shows empty state when no providers", () => {
    render(<HostingSection data={null} />);
    expect(
      screen.getByText(/No hosting details available/i),
    ).toBeInTheDocument();
  });
});
