/* @vitest-environment node */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

// Module-level (not nested in a single describe) so the PGlite client closes
// even when a test filter or watch mode only runs a subset of describes.
afterAll(async () => {
  await closePGliteDb();
});

// Hoist mock for @domainstack/core/whois
const whoisMock = vi.hoisted(() => ({
  lookupWhois: vi.fn<typeof import("@domainstack/core/whois").lookupWhois>(),
}));

vi.mock("@domainstack/core/whois", () => whoisMock);

// Mock Edge Config
vi.mock("@domainstack/catalog", () => ({
  getProviderCatalog: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
}));

// Mock provider detection
vi.mock("@domainstack/catalog/providers", () => ({
  detectRegistrar: vi.fn<(...args: unknown[]) => unknown>().mockReturnValue(null),
  getProvidersFromCatalog: vi.fn<(...args: unknown[]) => unknown[]>().mockReturnValue([]),
}));

describe("lookupWhoisStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks only clears call history; mockResolvedValue set by a
    // previous test would otherwise leak into a test that forgets to set
    // its own, so reset the implementation too.
    whoisMock.lookupWhois.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success with record when RDAP lookup succeeds", async () => {
    const mockRecord = {
      domain: "test.com",
      tld: "com",
      isRegistered: true,
      source: "rdap",
      registrar: { name: "GoDaddy" },
    };

    whoisMock.lookupWhois.mockResolvedValue({
      success: true,
      recordJson: JSON.stringify(mockRecord),
    });

    const { lookupWhoisStep } = await import("./registration");
    const result = await lookupWhoisStep("test.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected lookupWhoisStep to succeed");
    }
    expect(result.data.recordJson).toContain("test.com");
  });

  it("returns unsupported_tld error for unsupported TLDs", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "unsupported_tld",
    });

    const { lookupWhoisStep } = await import("./registration");
    const result = await lookupWhoisStep("unsupported.invalid");

    expect(result).toEqual({ success: false, error: "unsupported_tld" });
  });

  it("throws RetryableError on timeout", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "timeout",
    });

    const { lookupWhoisStep } = await import("./registration");

    await expect(lookupWhoisStep("slow.com")).rejects.toThrow("RDAP lookup timed out");
  });

  it("throws RetryableError on unknown failure", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "retry",
    });

    const { lookupWhoisStep } = await import("./registration");

    await expect(lookupWhoisStep("error.com")).rejects.toThrow("RDAP lookup failed");
  });
});

describe("normalizeAndBuildResponseStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds correct response for registered domain", async () => {
    const recordJson = JSON.stringify({
      domain: "registered.invalid",
      tld: "invalid",
      isRegistered: true,
      source: "rdap",
      creationDate: "2020-01-01T00:00:00Z",
      expirationDate: "2025-01-01T00:00:00Z",
      nameservers: [{ host: "ns1.test.invalid" }],
    });

    const { normalizeAndBuildResponseStep } = await import("./registration");
    const response = await normalizeAndBuildResponseStep(recordJson);

    expect(response.status).toBe("registered");
    expect(response.isRegistered).toBe(true);
    expect(response.creationDate).toBe("2020-01-01T00:00:00Z");
    expect(response.expirationDate).toBe("2025-01-01T00:00:00Z");
  });

  it("builds correct response for unregistered domain", async () => {
    const recordJson = JSON.stringify({
      domain: "available.invalid",
      tld: "invalid",
      isRegistered: false,
      source: "rdap",
    });

    const { normalizeAndBuildResponseStep } = await import("./registration");
    const response = await normalizeAndBuildResponseStep(recordJson);

    expect(response.status).toBe("unregistered");
    expect(response.isRegistered).toBe(false);
  });
});

describe("persistRegistrationStep", () => {
  beforeEach(async () => {
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  it("persists registered domain to database", async () => {
    // rawResponse is the raw RDAP JSON object (not prettified)
    const rawRdapResponse = {
      objectClassName: "domain",
      handle: "persist.com",
      ldhName: "persist.com",
    };

    const response = {
      domain: "persist.com",
      tld: "com",
      isRegistered: true,
      status: "registered" as const,
      source: "rdap" as const,
      registrarProvider: { id: null, name: "GoDaddy", domain: null },
      rawResponse: rawRdapResponse,
    };

    const { persistRegistrationStep } = await import("./registration");
    await persistRegistrationStep("persist.com", response);

    // Use the PGlite db instance (already set as the singleton)
    const { domains, registrations } = await import("@domainstack/db/schema");
    const { eq } = await import("@domainstack/db/drizzle");

    const domainRows = await db.select().from(domains).where(eq(domains.name, "persist.com"));

    expect(domainRows).toHaveLength(1);

    const regRows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.domainId, domainRows[0].id));

    expect(regRows).toHaveLength(1);
    expect(regRows[0].isRegistered).toBe(true);
  });
});
