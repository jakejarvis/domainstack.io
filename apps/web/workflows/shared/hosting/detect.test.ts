import type { DnsRecord, Header } from "@domainstack/types";
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
import { server } from "@/mocks/server";

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

// Mock schedule revalidation
vi.mock("@/lib/revalidation", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  // Stub the API key for tests
  vi.stubEnv("IPLOCATE_API_KEY", "test-api-key");
});

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

describe("detectAndResolveProvidersStep", () => {
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@/lib/db/pglite");
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  it("detects Vercel hosting from x-vercel-id header", async () => {
    const dnsRecords: DnsRecord[] = [
      { type: "A", name: "test.invalid", value: "1.2.3.4", ttl: 300 },
      {
        type: "NS",
        name: "test.invalid",
        value: "ns1.cloudflare.com",
        ttl: 86_400,
      },
    ];

    const headers: Header[] = [
      { name: "x-vercel-id", value: "abc123" },
      { name: "server", value: "Vercel" },
    ];

    const geoResult = {
      geo: {
        city: "San Francisco",
        region: "California",
        country: "United States",
        country_code: "US",
        lat: 37.7749,
        lon: -122.4194,
      },
      owner: "Vercel Inc.",
      domain: "vercel.com",
    };

    const { detectAndResolveProvidersStep } = await import("./detect");
    const result = await detectAndResolveProvidersStep(
      dnsRecords,
      headers,
      geoResult,
    );

    expect(result.hostingProvider.name).toBe("Vercel");
    expect(result.hostingProvider.domain).toBe("vercel.com");
  });

  it("detects Google Workspace email from MX records", async () => {
    const dnsRecords: DnsRecord[] = [
      { type: "A", name: "test.invalid", value: "1.2.3.4", ttl: 300 },
      {
        type: "MX",
        name: "test.invalid",
        value: "aspmx.l.google.com",
        ttl: 3600,
        priority: 1,
      },
    ];

    const headers: Header[] = [];

    const geoResult = {
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
      owner: null,
      domain: null,
    };

    const { detectAndResolveProvidersStep } = await import("./detect");
    const result = await detectAndResolveProvidersStep(
      dnsRecords,
      headers,
      geoResult,
    );

    expect(result.emailProvider.name).toBe("Google Workspace");
    expect(result.emailProvider.domain).toBe("google.com");
  });

  it("detects Cloudflare DNS from NS records", async () => {
    const dnsRecords: DnsRecord[] = [
      { type: "A", name: "test.invalid", value: "1.2.3.4", ttl: 300 },
      {
        type: "NS",
        name: "test.invalid",
        value: "ns1.cloudflare.com",
        ttl: 86_400,
      },
      {
        type: "NS",
        name: "test.invalid",
        value: "ns2.cloudflare.com",
        ttl: 86_400,
      },
    ];

    const headers: Header[] = [];

    const geoResult = {
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
      owner: null,
      domain: null,
    };

    const { detectAndResolveProvidersStep } = await import("./detect");
    const result = await detectAndResolveProvidersStep(
      dnsRecords,
      headers,
      geoResult,
    );

    expect(result.dnsProvider.name).toBe("Cloudflare");
    expect(result.dnsProvider.domain).toBe("cloudflare.com");
  });

  it("returns null hosting provider when no IP", async () => {
    const dnsRecords: DnsRecord[] = [];
    const headers: Header[] = [];
    const geoResult = null;

    const { detectAndResolveProvidersStep } = await import("./detect");
    const result = await detectAndResolveProvidersStep(
      dnsRecords,
      headers,
      geoResult,
    );

    expect(result.hostingProvider.name).toBeNull();
  });
});
