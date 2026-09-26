import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
/* @vitest-environment node */
import { RetryableError } from "workflow";

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
  lookupWhois: vi.fn<typeof import("@domainstack/core/whois/lookup").lookupWhois>(),
}));

// Only the WHOIS lookup is faked; normalize/persist come from the real module.
vi.mock("@domainstack/core/whois/lookup", () => whoisMock);

// Mock Edge Config
vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
}));

// Mock provider detection
vi.mock("@domainstack/utils/providers", () => ({
  detectRegistrar: vi.fn<(...args: unknown[]) => unknown>().mockReturnValue(null),
  getProvidersFromCatalog: vi.fn<(...args: unknown[]) => unknown[]>().mockReturnValue([]),
}));

/** How long from now a thrown RetryableError asks to wait, in ms. */
async function retryDelayMs(domain: string): Promise<number> {
  const { lookupWhoisStep } = await import("./registration");
  const err = await lookupWhoisStep(domain).then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!RetryableError.is(err)) throw new Error("Expected a RetryableError");
  return err.retryAfter.getTime() - Date.now();
}

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
      detail: { code: "no_server", attempts: [] },
    });

    const { lookupWhoisStep } = await import("./registration");
    const result = await lookupWhoisStep("unsupported.invalid");

    expect(result).toEqual({ success: false, error: "unsupported_tld" });
  });

  it("throws RetryableError on timeout", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "timeout",
      detail: { code: "timeout", phase: "whois", server: "whois.nic.sh", attempts: [] },
    });

    const { lookupWhoisStep } = await import("./registration");

    await expect(lookupWhoisStep("slow.com")).rejects.toThrow("RDAP lookup timed out");
  });

  it("throws RetryableError on unknown failure", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "retry",
      detail: { code: "connect_failed", attempts: [] },
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

describe("lookupWhoisStep retry delay", () => {
  beforeEach(() => {
    whoisMock.lookupWhois.mockReset();
  });

  const failure = (
    error: "retry" | "timeout",
    retryAfterMs?: number,
  ): Awaited<ReturnType<typeof import("@domainstack/core/whois/lookup").lookupWhois>> => ({
    success: false,
    error,
    detail: { code: "rate_limited", retryAfterMs, attempts: [] },
  });

  it.each([
    ["retry", 5_000],
    ["timeout", 10_000],
  ] as const)("uses the default delay for %s without a Retry-After", async (error, expected) => {
    whoisMock.lookupWhois.mockResolvedValue(failure(error));

    expect(await retryDelayMs("a.com")).toBeCloseTo(expected, -3);
  });

  it("honors a server-requested delay above the default", async () => {
    whoisMock.lookupWhois.mockResolvedValue(failure("retry", 30_000));

    expect(await retryDelayMs("a.com")).toBeCloseTo(30_000, -3);
  });

  it("never waits less than the default", async () => {
    whoisMock.lookupWhois.mockResolvedValue(failure("timeout", 1_000));

    expect(await retryDelayMs("a.com")).toBeCloseTo(10_000, -3);
  });

  it("caps an excessive server-requested delay at five minutes", async () => {
    whoisMock.lookupWhois.mockResolvedValue(failure("retry", 3_600_000));

    expect(await retryDelayMs("a.com")).toBeCloseTo(300_000, -3);
  });
});
