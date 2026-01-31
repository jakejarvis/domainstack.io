/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock rdapper before importing the module under test
vi.mock("rdapper", () => ({
  lookup: vi.fn(),
}));

// Import after mocking
import { lookup } from "rdapper";
import { fetchBootstrapData, lookupWhois } from "./lookup";

describe("lookupWhois", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    // Mock fetch to return undefined bootstrap by default (tests will override if needed)
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns success with recordJson on successful lookup", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: {
        domain: "example.com",
        tld: "com",
        isRegistered: true,
        source: "rdap",
      },
    });

    const result = await lookupWhois("example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.recordJson).toContain("example.com");
      const parsed = JSON.parse(result.recordJson);
      expect(parsed.domain).toBe("example.com");
    }
  });

  it("returns unsupported_tld for 'no whois server discovered' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "no whois server discovered",
    });

    const result = await lookupWhois("example.invalid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("returns unsupported_tld for 'no rdap server found' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "No RDAP server found for this TLD",
    });

    const result = await lookupWhois("example.obscure");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("returns unsupported_tld for 'tld is not supported' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "TLD is not supported by this service",
    });

    const result = await lookupWhois("example.unknown");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("returns unsupported_tld for 'registry may not publish public whois' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "This registry may not publish public whois data",
    });

    const result = await lookupWhois("example.private");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("returns unsupported_tld for 'no whois server configured' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "No whois server configured for this TLD",
    });

    const result = await lookupWhois("example.new");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("unsupported_tld");
    }
  });

  it("returns timeout for 'whois socket timeout' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "WHOIS socket timeout",
    });

    const result = await lookupWhois("slow.example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("timeout");
    }
  });

  it("returns timeout for 'whois timeout' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "Whois timeout exceeded",
    });

    const result = await lookupWhois("slow.example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("timeout");
    }
  });

  it("returns timeout for 'rdap timeout' error", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "RDAP timeout while fetching data",
    });

    const result = await lookupWhois("slow.example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("timeout");
    }
  });

  it("returns retry for generic errors", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "Connection refused",
    });

    const result = await lookupWhois("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("retry");
    }
  });

  it("returns retry when lookup throws an exception", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("Network error"));

    const result = await lookupWhois("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("retry");
    }
  });

  it("returns retry when ok is false but no specific error message", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: undefined,
    });

    const result = await lookupWhois("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("retry");
    }
  });

  it("returns retry when record is undefined", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: undefined,
    });

    const result = await lookupWhois("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("retry");
    }
  });

  it("uses provided customBootstrapData", async () => {
    const customBootstrap = {
      version: "1.0",
      publication: "2025-01-01",
      services: [],
    };

    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: {
        domain: "example.com",
        tld: "com",
        isRegistered: true,
        source: "rdap",
      },
    });

    await lookupWhois("example.com", { customBootstrapData: customBootstrap });

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({
        customBootstrapData: customBootstrap,
      }),
    );
  });

  it("uses default timeout of 5000ms", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: {
        domain: "example.com",
        tld: "com",
        isRegistered: true,
        source: "rdap",
      },
    });

    await lookupWhois("example.com");

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({
        timeoutMs: 5000,
      }),
    );
  });

  it("uses provided timeoutMs", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: {
        domain: "example.com",
        tld: "com",
        isRegistered: true,
        source: "rdap",
      },
    });

    await lookupWhois("example.com", { timeoutMs: 10000 });

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({
        timeoutMs: 10000,
      }),
    );
  });

  it("defaults includeRaw to true", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: {
        domain: "example.com",
        tld: "com",
        isRegistered: true,
        source: "rdap",
      },
    });

    await lookupWhois("example.com");

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({
        includeRaw: true,
      }),
    );
  });
});

describe("fetchBootstrapData", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns parsed JSON on success", async () => {
    const bootstrapData = {
      version: "1.0",
      services: [[["com"], ["https://rdap.verisign.com/com/v1/"]]],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(bootstrapData),
    });

    const result = await fetchBootstrapData();

    expect(result).toEqual(bootstrapData);
  });

  it("returns undefined on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await fetchBootstrapData();

    expect(result).toBeUndefined();
  });

  it("returns undefined on fetch exception", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchBootstrapData();

    expect(result).toBeUndefined();
  });

  it("includes userAgent header when provided", async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, options: RequestInit) => {
        capturedHeaders = (options.headers ?? {}) as Record<string, string>;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "1.0", services: [] }),
        });
      });

    await fetchBootstrapData("Domainstack/1.0");

    expect(capturedHeaders["User-Agent"]).toBe("Domainstack/1.0");
  });

  it("does not include userAgent header when not provided", async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, options: RequestInit) => {
        capturedHeaders = (options.headers ?? {}) as Record<string, string>;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: "1.0", services: [] }),
        });
      });

    await fetchBootstrapData();

    expect(capturedHeaders["User-Agent"]).toBeUndefined();
  });
});
