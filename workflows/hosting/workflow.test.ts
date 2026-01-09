/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { DnsRecord, Header } from "@/lib/types";
import { server } from "@/mocks/server";

// Mock GeoIP API
function mockGeoIp(
  ip: string,
  data: { city?: string; country?: string; org?: string } = {},
) {
  server.use(
    http.get(`https://ipwho.is/${ip}`, () => {
      return HttpResponse.json({
        success: true,
        ip,
        city: data.city ?? "San Francisco",
        region: "California",
        country: data.country ?? "United States",
        country_code: "US",
        latitude: 37.7749,
        longitude: -122.4194,
        connection: {
          org: data.org ?? "Cloudflare, Inc.",
          isp: data.org ?? "Cloudflare, Inc.",
          domain: "cloudflare.com",
        },
      });
    }),
  );
}

// Mock Edge Config for provider catalogs
const mockProviderCatalog = vi.hoisted(() =>
  vi.fn().mockImplementation((category: string) => {
    if (category === "hosting") {
      return Promise.resolve([
        {
          name: "Vercel",
          domain: "vercel.com",
          category: "hosting",
          rule: { kind: "headerPresent", name: "x-vercel-id" },
        },
        {
          name: "Cloudflare",
          domain: "cloudflare.com",
          category: "hosting",
          rule: { kind: "headerPresent", name: "cf-ray" },
        },
      ]);
    }
    if (category === "email") {
      return Promise.resolve([
        {
          name: "Google Workspace",
          domain: "google.com",
          category: "email",
          rule: { kind: "mxSuffix", suffix: "google.com" },
        },
      ]);
    }
    if (category === "dns") {
      return Promise.resolve([
        {
          name: "Cloudflare",
          domain: "cloudflare.com",
          category: "dns",
          rule: { kind: "nsSuffix", suffix: "cloudflare.com" },
        },
      ]);
    }
    return Promise.resolve([]);
  }),
);

vi.mock("@/lib/providers/catalog", () => ({
  getProviders: mockProviderCatalog,
}));

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("hostingWorkflow", () => {
  describe("provider detection", () => {
    it("detects Vercel hosting from headers", async () => {
      mockGeoIp("93.184.216.34");

      const dnsRecords: DnsRecord[] = [
        { type: "A", name: "example.com", value: "93.184.216.34", ttl: 300 },
        {
          type: "NS",
          name: "example.com",
          value: "ns1.example.com",
          ttl: 3600,
        },
      ];

      const headers: Header[] = [
        { name: "x-vercel-id", value: "sfo1::abc123" },
        { name: "server", value: "Vercel" },
      ];

      const { hostingWorkflow } = await import("./workflow");
      const result = await hostingWorkflow({
        domain: "example.com",
        dnsRecords,
        headers,
      });

      expect(result.success).toBe(true);
      expect(result.data?.hostingProvider.name).toBe("Vercel");
    });

    it("detects Cloudflare hosting from cf-ray header", async () => {
      mockGeoIp("104.21.2.1");

      const dnsRecords: DnsRecord[] = [
        { type: "A", name: "example.com", value: "104.21.2.1", ttl: 300 },
      ];

      const headers: Header[] = [
        { name: "cf-ray", value: "abc123-SFO" },
        { name: "server", value: "cloudflare" },
      ];

      const { hostingWorkflow } = await import("./workflow");
      const result = await hostingWorkflow({
        domain: "example.com",
        dnsRecords,
        headers,
      });

      expect(result.success).toBe(true);
      expect(result.data?.hostingProvider.name).toBe("Cloudflare");
    });

    it("detects Google Workspace email from MX records", async () => {
      mockGeoIp("93.184.216.34");

      const dnsRecords: DnsRecord[] = [
        { type: "A", name: "example.com", value: "93.184.216.34", ttl: 300 },
        {
          type: "MX",
          name: "example.com",
          value: "aspmx.l.google.com",
          ttl: 3600,
          priority: 1,
        },
        {
          type: "MX",
          name: "example.com",
          value: "alt1.aspmx.l.google.com",
          ttl: 3600,
          priority: 5,
        },
      ];

      const headers: Header[] = [];

      const { hostingWorkflow } = await import("./workflow");
      const result = await hostingWorkflow({
        domain: "example.com",
        dnsRecords,
        headers,
      });

      expect(result.success).toBe(true);
      expect(result.data?.emailProvider.name).toBe("Google Workspace");
    });

    it("detects Cloudflare DNS from NS records", async () => {
      mockGeoIp("93.184.216.34");

      const dnsRecords: DnsRecord[] = [
        { type: "A", name: "example.com", value: "93.184.216.34", ttl: 300 },
        {
          type: "NS",
          name: "example.com",
          value: "ns1.cloudflare.com",
          ttl: 3600,
        },
        {
          type: "NS",
          name: "example.com",
          value: "ns2.cloudflare.com",
          ttl: 3600,
        },
      ];

      const headers: Header[] = [];

      const { hostingWorkflow } = await import("./workflow");
      const result = await hostingWorkflow({
        domain: "example.com",
        dnsRecords,
        headers,
      });

      expect(result.success).toBe(true);
      expect(result.data?.dnsProvider.name).toBe("Cloudflare");
    });

    it("returns null providers when no IP available", async () => {
      const dnsRecords: DnsRecord[] = []; // No A/AAAA records
      const headers: Header[] = [];

      const { hostingWorkflow } = await import("./workflow");
      const result = await hostingWorkflow({
        domain: "example.com",
        dnsRecords,
        headers,
      });

      expect(result.success).toBe(true);
      expect(result.data?.hostingProvider.name).toBeNull();
      expect(result.data?.geo.city).toBe("");
    });

    it("falls back to GeoIP owner for unknown hosting", async () => {
      mockGeoIp("1.2.3.4", { org: "DigitalOcean, LLC" });

      const dnsRecords: DnsRecord[] = [
        { type: "A", name: "example.com", value: "1.2.3.4", ttl: 300 },
      ];

      const headers: Header[] = [
        { name: "server", value: "nginx" }, // No recognizable hosting header
      ];

      const { hostingWorkflow } = await import("./workflow");
      const result = await hostingWorkflow({
        domain: "example.com",
        dnsRecords,
        headers,
      });

      expect(result.success).toBe(true);
      expect(result.data?.hostingProvider.name).toBe("DigitalOcean, LLC");
    });
  });

  describe("persistHosting step", () => {
    it("persists hosting data to database", async () => {
      mockGeoIp("93.184.216.34", { city: "Los Angeles", country: "USA" });

      const dnsRecords: DnsRecord[] = [
        { type: "A", name: "persist.test", value: "93.184.216.34", ttl: 300 },
      ];

      const headers: Header[] = [{ name: "x-vercel-id", value: "lax1::xyz" }];

      const { hostingWorkflow } = await import("./workflow");
      await hostingWorkflow({
        domain: "persist.test",
        dnsRecords,
        headers,
      });

      // Verify persistence
      const { findDomainByName } = await import("@/lib/db/repos/domains");
      const domain = await findDomainByName("persist.test");

      if (!domain) {
        throw new Error("Expected domain to be created");
      }

      const { db } = await import("@/lib/db/client");
      const { hosting } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const stored = await db
        .select()
        .from(hosting)
        .where(eq(hosting.domainId, domain.id))
        .limit(1);

      expect(stored.length).toBe(1);
      expect(stored[0].geoCity).toBe("Los Angeles");
    });
  });
});
