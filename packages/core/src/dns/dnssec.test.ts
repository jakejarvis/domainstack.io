/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DohProvider } from "@domainstack/types";

import { fetchDnssec } from "./dnssec";

const provider = { key: "test", url: "https://dns.test/dns-query" } as unknown as DohProvider;

type Reply = { Status: number; AD?: boolean; Answer?: unknown[] };

/** Route DoH requests by record type and whether checking is disabled. */
function mockDoh(routes: Record<string, Reply | Error>) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const key = `${url.searchParams.get("type")}${url.searchParams.get("cd") ? ":cd" : ""}`;
    calls.push(key);
    const reply = routes[key] ?? { Status: 0 };
    if (reply instanceof Error) return Promise.reject(reply);
    return Promise.resolve({
      ok: true,
      headers: new Headers(),
      json: () => Promise.resolve(reply),
    } as Response);
  });
  return calls;
}

const DS_ANSWER = { name: "example.com.", type: 43, TTL: 3600, data: "2371 13 2 ABCD" };
const RRSIG_ANSWER = { name: "example.com.", type: 46, TTL: 60, data: "DS 13 2 3600 ..." };
const DNSKEY_ANSWER = {
  name: "example.com.",
  type: 48,
  TTL: 1800,
  data: "257 3 13 mdsswUyr3DPW",
};

describe("fetchDnssec", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reports secure with parsed DS/DNSKEY sets and the smallest TTL", async () => {
    mockDoh({
      SOA: { Status: 0, AD: true },
      "DS:cd": { Status: 0, Answer: [DS_ANSWER, RRSIG_ANSWER] },
      "DNSKEY:cd": { Status: 0, Answer: [DNSKEY_ANSWER] },
    });

    const result = await fetchDnssec("example.com", provider);

    expect(result.dnssec).toEqual({
      status: "secure",
      ds: [{ keyTag: 2371, algorithm: 13, digestType: 2, digest: "abcd" }],
      dnskeys: [{ flags: 257, protocol: 3, algorithm: 13, isKsk: true }],
    });
    expect(result.ttl).toBe(1800);
  });

  it("reports insecure for an unsigned zone", async () => {
    mockDoh({ SOA: { Status: 0, AD: false } });

    const result = await fetchDnssec("example.com", provider);

    expect(result.dnssec).toEqual({ status: "insecure", ds: [], dnskeys: [] });
    expect(result.ttl).toBeUndefined();
  });

  it("reports bogus when the validating query SERVFAILs but resolves unchecked", async () => {
    const calls = mockDoh({
      SOA: { Status: 2 },
      "SOA:cd": { Status: 0 },
      "DS:cd": { Status: 0, Answer: [DS_ANSWER] },
    });

    const result = await fetchDnssec("example.com", provider);

    expect(result.dnssec.status).toBe("bogus");
    expect(result.dnssec.ds).toHaveLength(1);
    expect(calls).toContain("SOA:cd");
  });

  it("does not run the unchecked comparison unless the validating query SERVFAILs", async () => {
    const calls = mockDoh({ SOA: { Status: 0, AD: true } });

    await fetchDnssec("example.com", provider);

    expect(calls).not.toContain("SOA:cd");
  });

  it("reports indeterminate when SERVFAIL persists unchecked", async () => {
    mockDoh({ SOA: { Status: 2 }, "SOA:cd": { Status: 2 } });

    const result = await fetchDnssec("example.com", provider);

    expect(result.dnssec.status).toBe("indeterminate");
  });

  it("ignores DS/DNSKEY answers from a non-NOERROR reply", async () => {
    mockDoh({
      SOA: { Status: 0, AD: true },
      "DS:cd": { Status: 3, Answer: [DS_ANSWER] },
    });

    const result = await fetchDnssec("example.com", provider);

    expect(result.dnssec.ds).toEqual([]);
  });

  it("throws on transport failure so the caller can fall back", async () => {
    mockDoh({ SOA: new Error("network down") });

    await expect(fetchDnssec("example.com", provider)).rejects.toThrow("network down");
  });
});
