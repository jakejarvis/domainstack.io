/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock for @domainstack/core/whois
const whoisMock = vi.hoisted(() => ({
  lookupWhois: vi.fn(),
}));

vi.mock("@domainstack/core/whois", () => whoisMock);

describe("lookupWhoisStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const { lookupWhoisStep } = await import("./fetch");
    const result = await lookupWhoisStep("test.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recordJson).toContain("test.com");
    }
  });

  it("returns unsupported_tld error for unsupported TLDs", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "unsupported_tld",
    });

    const { lookupWhoisStep } = await import("./fetch");
    const result = await lookupWhoisStep("unsupported.invalid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("throws RetryableError on timeout", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "timeout",
    });

    const { lookupWhoisStep } = await import("./fetch");

    await expect(lookupWhoisStep("slow.com")).rejects.toThrow(
      "RDAP lookup timed out",
    );
  });

  it("throws RetryableError on unknown failure", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "retry",
    });

    const { lookupWhoisStep } = await import("./fetch");

    await expect(lookupWhoisStep("error.com")).rejects.toThrow(
      "RDAP lookup failed",
    );
  });
});
