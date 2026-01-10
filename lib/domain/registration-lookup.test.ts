/* @vitest-environment node */
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

// Hoist mocks for rdapper
const rdapperMock = vi.hoisted(() => ({
  lookup: vi.fn(),
  getDomainTld: vi.fn((domain: string) => domain.split(".").pop() ?? ""),
}));

vi.mock("rdapper", () => rdapperMock);

// Mock RDAP bootstrap data
vi.mock("@/lib/rdap-bootstrap", () => ({
  getRdapBootstrapData: vi.fn().mockResolvedValue({
    version: "1.0",
    publication: "2024-01-01T00:00:00Z",
    services: [],
  }),
}));

// Mock provider catalog
vi.mock("@/lib/providers/catalog", () => ({
  getProviders: vi.fn().mockResolvedValue([]),
}));

// Mock provider detection
vi.mock("@/lib/providers/detection", () => ({
  detectRegistrar: vi.fn().mockReturnValue(null),
}));

// Mock schedule revalidation
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

// Mock providers repo for normalizeRdapRecord tests
vi.mock("@/lib/db/repos/providers", () => ({
  resolveOrCreateProviderId: vi.fn().mockResolvedValue(null),
  upsertCatalogProvider: vi.fn().mockResolvedValue({ id: "test-id" }),
}));

describe("lookupRdap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success with record when RDAP lookup succeeds", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: true,
      error: null,
      record: {
        domain: "example.com",
        tld: "com",
        isRegistered: true,
        source: "rdap",
        registrar: { name: "GoDaddy" },
      },
    });

    const { lookupRdap } = await import("./registration-lookup");
    const result = await lookupRdap("example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.recordJson).toContain("example.com");
    }
  });

  it("returns unsupported_tld error for unsupported TLDs", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: false,
      error: "No WHOIS server discovered for TLD",
      record: null,
    });

    const { lookupRdap } = await import("./registration-lookup");
    const result = await lookupRdap("example.ls");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("returns timeout error on WHOIS timeout", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: false,
      error: "WHOIS socket timeout",
      record: null,
    });

    const { lookupRdap } = await import("./registration-lookup");
    const result = await lookupRdap("slow.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("timeout");
    }
  });

  it("returns retry error on unknown failure", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: false,
      error: "Connection refused",
      record: null,
    });

    const { lookupRdap } = await import("./registration-lookup");
    const result = await lookupRdap("error.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("retry");
    }
  });
});

describe("buildErrorResponse", () => {
  it("builds correct response for unsupported TLD", async () => {
    const { buildErrorResponse } = await import("./registration-lookup");
    const response = buildErrorResponse("example.ls", "unsupported_tld");

    expect(response.domain).toBe("example.ls");
    expect(response.isRegistered).toBe(false);
    expect(response.status).toBe("unknown");
    expect(response.unavailableReason).toBe("unsupported_tld");
  });

  it("builds correct response for timeout", async () => {
    const { buildErrorResponse } = await import("./registration-lookup");
    const response = buildErrorResponse("slow.com", "timeout");

    expect(response.domain).toBe("slow.com");
    expect(response.unavailableReason).toBe("timeout");
  });
});

describe("normalizeRdapRecord", () => {
  it("builds correct response for registered domain", async () => {
    const recordJson = JSON.stringify({
      domain: "registered.com",
      tld: "com",
      isRegistered: true,
      source: "rdap",
      registrar: { name: "Namecheap", url: "https://namecheap.com" },
      creationDate: "2020-01-01T00:00:00Z",
      expirationDate: "2025-01-01T00:00:00Z",
      nameservers: [{ host: "ns1.example.com" }],
    });

    const { normalizeRdapRecord } = await import("./registration-lookup");
    const response = await normalizeRdapRecord(recordJson);

    expect(response.status).toBe("registered");
    expect(response.isRegistered).toBe(true);
    expect(response.creationDate).toBe("2020-01-01T00:00:00Z");
    expect(response.expirationDate).toBe("2025-01-01T00:00:00Z");
  });

  it("builds correct response for unregistered domain", async () => {
    const recordJson = JSON.stringify({
      domain: "available.com",
      tld: "com",
      isRegistered: false,
      source: "rdap",
    });

    const { normalizeRdapRecord } = await import("./registration-lookup");
    const response = await normalizeRdapRecord(recordJson);

    expect(response.status).toBe("unregistered");
    expect(response.isRegistered).toBe(false);
  });
});

describe("persistRegistrationData", () => {
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

  it("persists registered domain to database", async () => {
    // rawResponse is a pre-formatted string (pretty JSON for RDAP)
    const rawRdapResponse = JSON.stringify(
      {
        objectClassName: "domain",
        handle: "persist.com",
        ldhName: "persist.com",
      },
      null,
      2,
    );

    const response = {
      domain: "persist.com",
      tld: "com",
      isRegistered: true,
      status: "registered" as const,
      source: "rdap" as const,
      registrarProvider: { id: null, name: "GoDaddy", domain: null },
      rawResponse: rawRdapResponse,
    };

    const { persistRegistrationData } = await import("./registration-lookup");
    const domainId = await persistRegistrationData("persist.com", response);

    expect(domainId).toBeTruthy();

    const { db } = await import("@/lib/db/client");
    const { domains, registrations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const domainRows = await db
      .select()
      .from(domains)
      .where(eq(domains.name, "persist.com"));

    expect(domainRows).toHaveLength(1);

    const regRows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.domainId, domainRows[0].id));

    expect(regRows).toHaveLength(1);
    expect(regRows[0].isRegistered).toBe(true);
  });
});
