/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/cloudflare", () => ({ isCloudflareIp: () => Promise.resolve(false) }));

import { fetchDnsRecords } from "./fetch";

type Reply = { Status: number; AD?: boolean; Answer?: unknown[] };

function mockDoh(reply: (type: string, checkingDisabled: boolean) => Reply | Error) {
  const requests: Array<{ type: string; cd: boolean; do: boolean }> = [];
  globalThis.fetch = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const type = url.searchParams.get("type") ?? "";
    const cd = url.searchParams.has("cd");
    requests.push({ type, cd, do: url.searchParams.has("do") });
    const r = reply(type, cd);
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({
      ok: true,
      headers: new Headers(),
      json: () => Promise.resolve(r),
    } as Response);
  });
  return requests;
}

const A_ANSWER = { name: "example.com.", type: 1, TTL: 300, data: "192.0.2.1" };
const DS_ANSWER = { name: "example.com.", type: 43, TTL: 3600, data: "2371 13 2 abcdef0123" };
const DNSKEY_ANSWER = { name: "example.com.", type: 48, TTL: 1800, data: "257 3 13 mdsswUyr3DPW" };

describe("fetchDnsRecords DNSSEC", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("resolves records with checking disabled, and DNSSEC metadata with the DO bit", async () => {
    const requests = mockDoh((type) => {
      switch (type) {
        case "A":
          return { Status: 0, Answer: [A_ANSWER] };
        case "SOA":
          return { Status: 0, AD: true };
        case "DS":
          return { Status: 0, Answer: [DS_ANSWER] };
        case "DNSKEY":
          return { Status: 0, Answer: [DNSKEY_ANSWER] };
        default:
          return { Status: 0 };
      }
    });

    const now = new Date("2024-01-01T00:00:00.000Z");
    const data = await fetchDnsRecords("example.com", now);

    expect(data.records).toHaveLength(1);
    expect(data.dnssec).toEqual({
      status: "secure",
      ds: [{ keyTag: 2371, algorithm: 13, digestType: 2, digest: "abcdef0123" }],
      dnskeys: [{ flags: 257, protocol: 3, algorithm: 13, isKsk: true }],
    });
    // The DNSKEY TTL (1800s) is shorter than the DS TTL (3600s) and the default
    // record TTL, so it drives expiry.
    expect(data.dnssecExpiresAt).toBe("2024-01-01T00:30:00.000Z");

    const recordQueries = requests.filter((r) => ["A", "AAAA", "MX", "TXT", "NS"].includes(r.type));
    expect(recordQueries.length).toBeGreaterThan(0);
    expect(recordQueries.every((r) => r.cd)).toBe(true);
    expect(recordQueries.every((r) => !r.do)).toBe(true);

    const dnssecQueries = requests.filter((r) => ["SOA", "DS", "DNSKEY"].includes(r.type));
    expect(dnssecQueries.length).toBeGreaterThan(0);
    expect(dnssecQueries.every((r) => r.do)).toBe(true);
  });

  it("still returns records, with an indeterminate status, when the DNSSEC check fails", async () => {
    mockDoh((type) =>
      type === "A"
        ? { Status: 0, Answer: [A_ANSWER] }
        : type === "SOA"
          ? new Error("soa exploded")
          : { Status: 0 },
    );

    const data = await fetchDnsRecords("example.com");

    expect(data.records).toHaveLength(1);
    expect(data.dnssec).toEqual({ status: "indeterminate", ds: [], dnskeys: [] });
  });

  it("keeps the SOA-derived status when only the DS/DNSKEY metadata queries fail", async () => {
    mockDoh((type) => {
      switch (type) {
        case "A":
          return { Status: 0, Answer: [A_ANSWER] };
        case "SOA":
          return { Status: 0, AD: true };
        case "DS":
        case "DNSKEY":
          return new Error("metadata transport failure");
        default:
          return { Status: 0 };
      }
    });

    const data = await fetchDnsRecords("example.com");

    // A DS/DNSKEY transport failure is best-effort metadata loss, not a reason
    // to discard the validated SOA status.
    expect(data.dnssec).toEqual({ status: "secure", ds: [], dnskeys: [] });
  });
});
