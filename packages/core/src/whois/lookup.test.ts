/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock rdapper before importing the module under test
vi.mock("rdapper", () => ({
  lookup: vi.fn<typeof import("rdapper").lookup>(),
}));

// Import after mocking
import { lookup } from "rdapper";

import { fetchBootstrapData, lookupWhois } from "./lookup";

describe("lookupWhois", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    // Mock fetch to return undefined bootstrap by default (tests will override if needed)
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
    } as Response);
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
      attempts: [],
    });

    const result = await lookupWhois("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected lookupWhois to succeed");
    }
    expect(result.recordJson).toContain("example.com");
    const parsed = JSON.parse(result.recordJson);
    expect(parsed.domain).toBe("example.com");
  });

  it("returns unsupported_tld only when rdapper reports no_server", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "No WHOIS server discovered for TLD 'invalid'.",
      errorCode: "no_server",
      attempts: [],
    });

    const result = await lookupWhois("example.invalid");

    expect(result).toMatchObject({ success: false, error: "unsupported_tld" });
  });

  it("returns unsupported_tld when the WHOIS server blocks this client", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "WHOIS server whois.nic.ch refuses requests from this client",
      errorCode: "blocked",
      errorPhase: "whois",
      errorServer: "whois.nic.ch",
      attempts: [],
    });

    const result = await lookupWhois("nic.ch");

    expect(result).toMatchObject({
      success: false,
      error: "unsupported_tld",
      detail: { code: "blocked", server: "whois.nic.ch" },
    });
  });

  it("carries retryAfterMs from a rate-limited RDAP response", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "RDAP 429 rate limited (Retry-After: 30)",
      errorCode: "rate_limited",
      retryAfterMs: 30_000,
      attempts: [],
    });

    const result = await lookupWhois("example.com");

    expect(result).toMatchObject({
      success: false,
      error: "retry",
      detail: { code: "rate_limited", retryAfterMs: 30_000 },
    });
  });

  it("does not treat a failed IANA query as an unsupported TLD", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "WHOIS read timeout (whois.iana.org)",
      errorCode: "timeout",
      errorPhase: "iana",
      errorServer: "whois.iana.org",
      attempts: [],
    });

    const result = await lookupWhois("example.sh");

    expect(result).toMatchObject({ success: false, error: "timeout" });
  });

  it.each([
    "connect_failed",
    "http_error",
    "no_data",
    "rate_limited",
    "unparseable",
    "unsupported_runtime",
    "aborted",
    "unknown",
  ] as const)("returns retry for errorCode %s", async (errorCode) => {
    vi.mocked(lookup).mockResolvedValue({ ok: false, error: "boom", errorCode, attempts: [] });

    const result = await lookupWhois("example.com");

    expect(result).toMatchObject({ success: false, error: "retry" });
  });

  it("returns timeout for a deadline timeout", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "Lookup deadline exceeded (10000ms)",
      errorCode: "timeout",
      attempts: [],
    });

    const result = await lookupWhois("slow.example.com");

    expect(result).toMatchObject({ success: false, error: "timeout" });
  });

  it("exposes rdapper diagnostics on failure", async () => {
    const attempts = [
      { phase: "iana", server: "whois.iana.org", ok: true, durationMs: 120 },
      {
        phase: "whois",
        server: "whois.nic.sh",
        ok: false,
        durationMs: 5000,
        errorCode: "timeout",
        error: "WHOIS read timeout (whois.nic.sh)",
        stage: "read",
      },
    ] as const;
    vi.mocked(lookup).mockResolvedValue({
      ok: false,
      error: "WHOIS read timeout (whois.nic.sh)",
      errorCode: "timeout",
      errorPhase: "whois",
      errorServer: "whois.nic.sh",
      attempts: [...attempts],
    });

    const result = await lookupWhois("executor.sh");

    expect(result).toEqual({
      success: false,
      error: "timeout",
      detail: {
        message: "WHOIS read timeout (whois.nic.sh)",
        code: "timeout",
        phase: "whois",
        server: "whois.nic.sh",
        attempts,
      },
    });
  });

  it("returns retry with the error message when lookup throws", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("Network error"));

    const result = await lookupWhois("example.com");

    expect(result).toEqual({
      success: false,
      error: "retry",
      detail: { message: "Network error", attempts: [] },
    });
  });

  it("returns retry when ok is false but no error code", async () => {
    vi.mocked(lookup).mockResolvedValue({ ok: false, error: undefined, attempts: [] });

    const result = await lookupWhois("example.com");

    expect(result).toMatchObject({ success: false, error: "retry" });
  });

  it("returns retry when record is undefined", async () => {
    vi.mocked(lookup).mockResolvedValue({ ok: true, record: undefined, attempts: [] });

    const result = await lookupWhois("example.com");

    expect(result).toMatchObject({ success: false, error: "retry" });
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
      attempts: [],
    });

    await lookupWhois("example.com", { customBootstrapData: customBootstrap });

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({
        customBootstrapData: customBootstrap,
      }),
    );
  });

  it("omits customBootstrapData when the bootstrap fetch fails, so rdapper loads its own", async () => {
    // beforeEach makes the bootstrap fetch fail (ok: false)
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: { domain: "example.com", tld: "com", isRegistered: true, source: "rdap" },
      attempts: [],
    });

    await lookupWhois("example.com");

    const passed = vi.mocked(lookup).mock.calls[0]?.[1] ?? {};
    // rdapper rejects the key even when its value is undefined
    expect("customBootstrapData" in passed).toBe(false);
  });

  it("passes the fetched bootstrap data through to rdapper", async () => {
    const bootstrap = { version: "1.0", services: [[["com"], ["https://rdap.example/"]]] };
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(bootstrap),
    } as Response);
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: { domain: "example.com", tld: "com", isRegistered: true, source: "rdap" },
      attempts: [],
    });

    await lookupWhois("example.com");

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({ customBootstrapData: bootstrap }),
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
      attempts: [],
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
      attempts: [],
    });

    await lookupWhois("example.com", { timeoutMs: 10000 });

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({
        timeoutMs: 10000,
      }),
    );
  });

  it("uses default deadline of 10000ms", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: { domain: "example.com", tld: "com", isRegistered: true, source: "rdap" },
      attempts: [],
    });

    await lookupWhois("example.com");

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({ deadlineMs: 10_000 }),
    );
  });

  it("uses provided deadlineMs", async () => {
    vi.mocked(lookup).mockResolvedValue({
      ok: true,
      record: { domain: "example.com", tld: "com", isRegistered: true, source: "rdap" },
      attempts: [],
    });

    await lookupWhois("example.com", { deadlineMs: 3000 });

    expect(lookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({ deadlineMs: 3000 }),
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
      attempts: [],
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

    global.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(bootstrapData),
    } as Response);

    const result = await fetchBootstrapData();

    expect(result).toEqual(bootstrapData);
  });

  it("returns undefined on HTTP error", async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await fetchBootstrapData();

    expect(result).toBeUndefined();
  });

  it.each([
    ["an error page body", "<html>oops</html>"],
    ["JSON without a services array", { version: "1.0" }],
    ["null", null],
  ])("returns undefined for %s", async (_label, body) => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: () =>
        typeof body === "string"
          ? Promise.reject(new SyntaxError("bad json"))
          : Promise.resolve(body),
    } as Response);

    const result = await fetchBootstrapData();

    expect(result).toBeUndefined();
  });

  it("returns undefined on fetch exception", async () => {
    global.fetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("Network error"));

    const result = await fetchBootstrapData();

    expect(result).toBeUndefined();
  });

  it("includes userAgent header when provided", async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn<typeof fetch>().mockImplementation((_url, options) => {
      capturedHeaders = (options?.headers ?? {}) as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ version: "1.0", services: [] }),
      } as Response);
    });

    await fetchBootstrapData("Domainstack/1.0");

    expect(capturedHeaders["User-Agent"]).toBe("Domainstack/1.0");
  });

  it("bounds the request with an abort signal", async () => {
    let capturedSignal: AbortSignal | null | undefined;

    global.fetch = vi.fn<typeof fetch>().mockImplementation((_url, options) => {
      capturedSignal = options?.signal;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ version: "1.0", services: [] }),
      } as Response);
    });

    await fetchBootstrapData();

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("does not include userAgent header when not provided", async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn<typeof fetch>().mockImplementation((_url, options) => {
      capturedHeaders = (options?.headers ?? {}) as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ version: "1.0", services: [] }),
      } as Response);
    });

    await fetchBootstrapData();

    expect(capturedHeaders["User-Agent"]).toBeUndefined();
  });
});
