/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostingSection } from "./hosting-section";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  // biome-ignore lint/suspicious/noExplicitAny: fine for this test
  default: (_loader: any, _opts: any) => {
    // return a dummy component to avoid map rendering
    return () => <div data-slot="hosting-map" />;
  },
}));

vi.mock("@/components/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) => <div>icon:{domain}</div>,
}));

describe("HostingSection", () => {
  it("renders provider names and icons", () => {
    const data = {
      dnsProvider: { name: "Cloudflare", domain: "cloudflare.com" },
      hostingProvider: { name: "Vercel", domain: "vercel.com" },
      emailProvider: { name: "Google Workspace", domain: "google.com" },
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
    } as unknown as import("@/lib/schemas").Hosting;
    render(<HostingSection data={data} />);
    expect(screen.getByText("Cloudflare")).toBeInTheDocument();
    expect(screen.getByText(/icon:cloudflare.com/)).toBeInTheDocument();
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
