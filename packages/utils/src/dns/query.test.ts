import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* @vitest-environment node */
import type { DohProvider } from "@domainstack/types";

import { providerOrderForLookup, queryDohProvider } from "./query";

// Use type assertion for mock provider since DohProvider is a literal union type
const mockProvider = {
  key: "test",
  name: "Test Provider",
  url: "https://dns.test/dns-query",
} as unknown as DohProvider;

function mockFetchResponse(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  globalThis.fetch = vi
    .fn<typeof fetch>()
    .mockResolvedValue({ headers: new Headers(), ...response } as Response);
}

function mockFetchImplementation(implementation: typeof fetch) {
  globalThis.fetch = vi.fn<typeof fetch>().mockImplementation(implementation);
}

describe("providerOrderForLookup", () => {
  it("returns all providers", () => {
    const result = providerOrderForLookup("example.test");
    expect(result.length).toBeGreaterThan(0);
  });

  it("is deterministic for same domain", () => {
    const domain = "example.test";
    const result1 = providerOrderForLookup(domain);
    const result2 = providerOrderForLookup(domain);
    expect(result1).toEqual(result2);
  });

  it("is case-insensitive (RFC 1035)", () => {
    const lower = providerOrderForLookup("example.test");
    const upper = providerOrderForLookup("EXAMPLE.TEST");
    const mixed = providerOrderForLookup("Example.Test");

    expect(lower).toEqual(upper);
    expect(lower).toEqual(mixed);
  });

  it("produces different orders for different domains", () => {
    const order1 = providerOrderForLookup("example.test");
    const order2 = providerOrderForLookup("google.test");

    // Different domains should likely produce different orders
    // (not guaranteed, but statistically likely with good hash function)
    const sameOrder =
      order1.every((p, i) => p.key === order2[i]?.key) && order1.length === order2.length;

    // This test may occasionally fail with a poor hash or collision,
    // but simpleHash should distribute well enough for common domains
    expect(sameOrder).toBe(false);
  });
});

describe("queryDohProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns answers for successful response", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 0,
          Answer: [{ name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" }],
        }),
    });

    const answers = await queryDohProvider(mockProvider, "example.com", "A");

    expect(answers).toHaveLength(1);
    expect(answers[0]?.data).toBe("93.184.216.34");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns empty array for NXDOMAIN (Status 3)", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 3, // NXDOMAIN
          Answer: undefined,
        }),
    });

    const answers = await queryDohProvider(mockProvider, "nonexistent.test", "A");

    expect(answers).toEqual([]);
  });

  it("returns empty array when Answer is undefined", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 0,
          // No Answer field
        }),
    });

    const answers = await queryDohProvider(mockProvider, "example.com", "A");

    expect(answers).toEqual([]);
  });

  it("throws on SERVFAIL (Status 2) instead of returning an empty array", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 2, // SERVFAIL
          Answer: undefined,
        }),
    });

    await expect(queryDohProvider(mockProvider, "example.com", "A")).rejects.toThrow(
      "DoH query failed: test A rcode=2",
    );
  });

  it("throws on REFUSED (Status 5) instead of returning an empty array", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 5, // REFUSED
          Answer: undefined,
        }),
    });

    await expect(queryDohProvider(mockProvider, "example.com", "A")).rejects.toThrow(
      "DoH query failed: test A rcode=5",
    );
  });

  it("returns empty array for NOERROR (Status 0) with no Answer section", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 0,
          Answer: undefined,
        }),
    });

    const answers = await queryDohProvider(mockProvider, "example.com", "A");

    expect(answers).toEqual([]);
  });

  it("returns empty array for NXDOMAIN (Status 3) even with a populated Answer section", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 3, // NXDOMAIN
          Answer: [{ name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" }],
        }),
    });

    const answers = await queryDohProvider(mockProvider, "example.com", "A");

    expect(answers).toEqual([]);
  });

  it("throws on non-2xx HTTP response", async () => {
    mockFetchResponse({
      ok: false,
      status: 500,
    });

    await expect(queryDohProvider(mockProvider, "example.com", "A")).rejects.toThrow(
      "DoH query failed: test A 500",
    );
  });

  it("throws on non-object JSON response", async () => {
    mockFetchResponse({
      ok: true,
      json: () => Promise.resolve(null),
    });

    await expect(queryDohProvider(mockProvider, "example.com", "A")).rejects.toThrow(
      "DoH invalid response: test (not an object)",
    );
  });

  it("throws when Answer is not an array", async () => {
    mockFetchResponse({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 0,
          Answer: "not an array",
        }),
    });

    await expect(queryDohProvider(mockProvider, "example.com", "A")).rejects.toThrow(
      "DoH invalid response: test (Answer is not an array)",
    );
  });

  it("adds cacheBust parameter when option is true", async () => {
    let capturedUrl = "";
    mockFetchImplementation((input) => {
      capturedUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ Status: 0 }),
      } as Response);
    });

    await queryDohProvider(mockProvider, "example.com", "A", {
      cacheBust: true,
    });

    expect(capturedUrl).toContain("&t=");
  });

  it("does not add cacheBust parameter by default", async () => {
    let capturedUrl = "";
    mockFetchImplementation((input) => {
      capturedUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ Status: 0 }),
      } as Response);
    });

    await queryDohProvider(mockProvider, "example.com", "A");

    expect(capturedUrl).not.toContain("&t=");
  });

  it("sets correct Accept header", async () => {
    let capturedHeaders: Record<string, string> = {};
    mockFetchImplementation((_input, options) => {
      capturedHeaders = options?.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ Status: 0 }),
      } as Response);
    });

    await queryDohProvider(mockProvider, "example.com", "A");

    expect(capturedHeaders.Accept).toBe("application/dns-json");
  });
});
