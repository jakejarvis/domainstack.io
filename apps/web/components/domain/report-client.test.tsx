import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

type Lookup = { success: true; cached: boolean; data: unknown } | { success: false; error: string };

const lookups = vi.hoisted(() => ({
  getRegistration: vi.fn<(input: { domain: string }) => Promise<Lookup>>(),
  getHosting: vi.fn<(input: { domain: string }) => Promise<Lookup>>(),
  getDnsRecords: vi.fn<(input: { domain: string }) => Promise<Lookup>>(),
  getCertificates: vi.fn<(input: { domain: string }) => Promise<Lookup>>(),
  getHeaders: vi.fn<(input: { domain: string }) => Promise<Lookup>>(),
  getSeo: vi.fn<(input: { domain: string }) => Promise<Lookup>>(),
}));
const exportDomainData = vi.hoisted(() => vi.fn<(domain: string, data: unknown) => void>());

vi.mock("@/lib/trpc/client", () => {
  const procedure = (name: string, fn: (input: { domain: string }) => Promise<unknown>) => ({
    queryOptions: (input: { domain: string }, opts?: object) => ({
      ...opts,
      queryKey: [["domain", name], { input, type: "query" }] as const,
      queryFn: () => fn(input),
    }),
    queryFilter: (input: { domain: string }) => ({
      queryKey: [["domain", name], { input, type: "query" }] as const,
    }),
  });
  const trpc = {
    domain: Object.fromEntries(
      Object.entries(lookups).map(([name, fn]) => [name, procedure(name, fn)]),
    ),
    tracking: {
      getTrackingStatus: {
        queryOptions: () => ({ queryKey: ["tracking"], queryFn: async () => null }),
      },
    },
  };
  return { useTRPC: () => trpc };
});
vi.mock("@domainstack/auth/client", () => ({
  useSession: () => ({ data: null, isPending: false }),
}));
vi.mock("@/lib/json-export", () => ({ exportDomainData }));
vi.mock("@/components/icons/favicon", () => ({ Favicon: () => null }));
vi.mock("@/components/domain/screenshot-popover", () => ({
  ScreenshotPopover: ({
    domain,
    domainId,
    children,
  }: {
    domain: string;
    domainId?: string;
    children: React.ReactNode;
  }) => (
    <div>
      {children}
      <span>
        screenshot:{domain}:{domainId ?? "none"}
      </span>
    </div>
  ),
}));
vi.mock("@/components/domain/tools-dropdown", () => ({
  ToolsDropdown: ({ domain }: { domain: string }) => <span>tools:{domain}</span>,
}));
vi.mock("@/components/domain/registrar-links", () => ({
  RegistrarLinks: ({ tld }: { tld: string }) => <span>pricing:{tld}</span>,
  RegistrarLinksSkeleton: () => null,
}));
vi.mock("@/components/domain/registration/registration-section", () => ({
  RegistrationSection: ({ data, scope }: { data?: { domain: string }; scope?: string }) => (
    <span>
      registration:{data?.domain}:{scope ?? "no-scope"}
    </span>
  ),
}));
function stubSection(label: string) {
  return ({ domain }: { domain: string }) => (
    <span>
      {label}:{domain}
    </span>
  );
}
vi.mock("@/components/domain/hosting/hosting-section", () => ({
  HostingSection: stubSection("hosting"),
}));
vi.mock("@/components/domain/dns/dns-section", () => ({ DnsSection: stubSection("dns") }));
vi.mock("@/components/domain/certificates/certificates-section", () => ({
  CertificatesSection: stubSection("certificates"),
}));
vi.mock("@/components/domain/headers/headers-section", () => ({
  HeadersSection: stubSection("headers"),
}));
vi.mock("@/components/domain/seo/seo-section", () => ({ SeoSection: stubSection("seo") }));

import { DomainReportClient } from "@/components/domain/report-client";
import { render } from "@/mocks/react";
import { TooltipProvider } from "@domainstack/ui/tooltip";

const ok = (data: unknown): Lookup => ({ success: true, cached: true, data });

function registration(domain: string, isRegistered = true) {
  return ok({ domain, isRegistered, domainId: `id-${domain}` });
}

function renderReport(hostname: string, registrableDomain: string, pricingTld: string | null) {
  return render(
    <TooltipProvider>
      <DomainReportClient
        hostname={hostname}
        registrableDomain={registrableDomain}
        pricingTld={pricingTld}
      />
    </TooltipProvider>,
  );
}

describe("DomainReportClient", () => {
  beforeEach(() => {
    lookups.getRegistration.mockImplementation(async ({ domain }) => registration(domain));
    for (const name of [
      "getHosting",
      "getDnsRecords",
      "getCertificates",
      "getHeaders",
      "getSeo",
    ] as const) {
      lookups[name].mockImplementation(async ({ domain }) => ok({ domain }));
    }
    // The DNS lookup carries the hostname's own row id.
    lookups.getDnsRecords.mockImplementation(async ({ domain }) =>
      ok({ domain, domainId: `host-${domain}` }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("for a subdomain", () => {
    it("queries registration for the parent and every other section for the hostname", async () => {
      await renderReport("api.example.com", "example.com", null);

      await expect.element(page.getByText("registration:example.com:example.com")).toBeVisible();
      for (const label of ["hosting", "dns", "certificates", "headers", "seo"]) {
        await expect.element(page.getByText(`${label}:api.example.com`)).toBeVisible();
      }
      expect(lookups.getRegistration).toHaveBeenCalledWith({ domain: "example.com" });
      expect(lookups.getDnsRecords).toHaveBeenCalledWith({ domain: "api.example.com" });
      expect(lookups.getSeo).toHaveBeenCalledWith({ domain: "api.example.com" });
    });

    it("shows the hostname with a link to its registered domain", async () => {
      await renderReport("api.example.com", "example.com", null);

      await expect.element(page.getByRole("heading", { name: "api.example.com" })).toBeVisible();
      await expect.element(page.getByText("Subdomain", { exact: true })).toBeVisible();
      await expect
        .element(page.getByRole("link", { name: "example.com", exact: true }))
        .toHaveAttribute("href", "/example.com");
    });

    it("tracks the parent, while tools and screenshots target the hostname", async () => {
      await renderReport("api.example.com", "example.com", null);

      await expect
        .element(page.getByRole("button", { name: "Track domain" }))
        .toHaveAttribute("href", "/login");
      await expect.element(page.getByText("tools:api.example.com")).toBeVisible();
      // The hostname's own row id, never the registration row's (id-example.com).
      await expect
        .element(page.getByText("screenshot:api.example.com:host-api.example.com"))
        .toBeVisible();
    });

    it("keeps healthy sections when registration fails", async () => {
      lookups.getRegistration.mockResolvedValue({ success: false, error: "fetch_failed" });

      await renderReport("api.example.com", "example.com", null);

      await expect.element(page.getByText("Failed to load registration data")).toBeVisible();
      await expect.element(page.getByText("dns:api.example.com")).toBeVisible();
      await expect.element(page.getByText("headers:api.example.com")).toBeVisible();
    });

    it("keeps other sections when one section fails", async () => {
      lookups.getCertificates.mockResolvedValue({ success: false, error: "fetch_failed" });

      await renderReport("api.example.com", "example.com", null);

      await expect.element(page.getByText("dns:api.example.com")).toBeVisible();
      await expect.element(page.getByText("seo:api.example.com")).toBeVisible();
      await expect.element(page.getByText("Failed to load data")).toBeVisible();
    });

    it("explains an unregistered parent without offering the subdomain for sale", async () => {
      lookups.getRegistration.mockResolvedValue(registration("example.com", false));

      await renderReport("api.example.com", "example.com", "com");

      await expect.element(page.getByText("appears to be unregistered…")).toBeVisible();
      await expect
        .element(page.getByText(/cannot exist in public DNS until its registered domain exists/))
        .toBeVisible();
      await expect
        .element(page.getByRole("link", { name: "View example.com" }))
        .toHaveAttribute("href", "/example.com");
      expect(page.getByText(/^pricing:/).elements()).toHaveLength(0);
      expect(page.getByRole("heading", { name: "api.example.com" }).elements()).toHaveLength(0);
    });

    it("exports registration under the parent key and the rest under the hostname", async () => {
      await renderReport("api.example.com", "example.com", null);

      const exportButton = page.getByRole("button", { name: "Export report" });
      await expect.element(exportButton).toBeEnabled();
      await exportButton.click();

      expect(exportDomainData).toHaveBeenCalledWith(
        "api.example.com",
        expect.objectContaining({
          registration: expect.objectContaining({ domain: "example.com" }),
          dns: { domain: "api.example.com", domainId: "host-api.example.com" },
          hosting: { domain: "api.example.com" },
          certificates: { domain: "api.example.com" },
          headers: { domain: "api.example.com" },
          seo: { domain: "api.example.com" },
        }),
      );
    });
  });

  describe("for a registrable domain", () => {
    it("renders every section for the domain, without a subdomain label", async () => {
      await renderReport("example.com", "example.com", "com");

      await expect.element(page.getByText("registration:example.com:no-scope")).toBeVisible();
      await expect.element(page.getByText("dns:example.com")).toBeVisible();
      expect(page.getByText("Subdomain", { exact: true }).elements()).toHaveLength(0);
    });

    it("passes the registration row's id to the screenshot", async () => {
      await renderReport("example.com", "example.com", "com");

      await expect.element(page.getByText("screenshot:example.com:id-example.com")).toBeVisible();
    });

    it("falls back to the DNS row id when registration fails", async () => {
      lookups.getRegistration.mockResolvedValue({ success: false, error: "fetch_failed" });

      await renderReport("example.com", "example.com", "com");

      await expect.element(page.getByText("screenshot:example.com:host-example.com")).toBeVisible();
    });

    it("keeps the purchase flow when unregistered", async () => {
      lookups.getRegistration.mockResolvedValue(registration("example.com", false));

      await renderReport("example.com", "example.com", "com");

      await expect.element(page.getByText("appears to be unregistered…")).toBeVisible();
      await expect.element(page.getByText("pricing:com")).toBeVisible();
      expect(page.getByText(/cannot exist in public DNS/).elements()).toHaveLength(0);
    });
  });
});
