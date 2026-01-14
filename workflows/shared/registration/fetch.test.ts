/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("lookupWhoisStep", () => {
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

    const { lookupWhoisStep } = await import("./fetch");
    const result = await lookupWhoisStep("example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recordJson).toContain("example.com");
    }
  });

  it("returns unsupported_tld error for unsupported TLDs", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: false,
      error: "No WHOIS server discovered for TLD",
      record: null,
    });

    const { lookupWhoisStep } = await import("./fetch");
    const result = await lookupWhoisStep("example.ls");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("throws RetryableError on timeout", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: false,
      error: "WHOIS socket timeout",
      record: null,
    });

    const { lookupWhoisStep } = await import("./fetch");

    await expect(lookupWhoisStep("slow.com")).rejects.toThrow(
      "RDAP lookup timed out",
    );
  });

  it("throws RetryableError on unknown failure", async () => {
    rdapperMock.lookup.mockResolvedValue({
      ok: false,
      error: "Connection refused",
      record: null,
    });

    const { lookupWhoisStep } = await import("./fetch");

    await expect(lookupWhoisStep("error.com")).rejects.toThrow(
      "RDAP lookup failed",
    );
  });
});
