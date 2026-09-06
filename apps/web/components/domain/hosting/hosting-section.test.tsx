import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { HostingSection } from "./hosting-section";

vi.mock("@/components/icons/provider-logo", () => ({
  ProviderLogo: ({ providerId }: { providerId: string | null | undefined }) => (
    <div>logo:{providerId}</div>
  ),
}));

// Mock the map client to avoid loading maplibre-gl in tests
vi.mock("@/components/domain/hosting/hosting-map-client", () => ({
  HostingMapClient: ({ lat, lon }: { lat: number; lon: number }) => (
    <div data-testid="hosting-map">
      Map: {lat}, {lon}
    </div>
  ),
}));

describe("HostingSection", () => {
  it("renders provider names and icons", async () => {
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
    } as unknown as import("@domainstack/types").HostingResponse;
    await render(<HostingSection data={data} />);
    await expect.element(page.getByText("Cloudflare", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText(/logo:provider-cloudflare/)).toBeInTheDocument();
    await expect.element(page.getByText("Vercel", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Google Workspace", { exact: true })).toBeInTheDocument();
  });

  it("shows empty state when no providers", async () => {
    await render(<HostingSection data={null} />);
    await expect.element(page.getByText(/No hosting details available/i)).toBeInTheDocument();
  });
});
