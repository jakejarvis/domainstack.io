/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/cloudflare", () => ({ isCloudflareIp: () => Promise.resolve(false) }));

import { fetchDnsRecords } from "./fetch";

type Reply = { Status: number; AD?: boolean; Answer?: unknown[] };

function mockDoh(reply: (type: string, checkingDisabled: boolean) => Reply | Error) {
  const requests: Array<{ type: string; cd: boolean }> = [];
  globalThis.fetch = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const type = url.searchParams.get("type") ?? "";
    const cd = url.searchParams.has("cd");
    requests.push({ type, cd });
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

describe("fetchDnsRecords DNSSEC", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("resolves records with checking disabled and returns a validated status", async () => {
    const requests = mockDoh((type) =>
      type === "A"
        ? { Status: 0, Answer: [A_ANSWER] }
        : type === "SOA"
          ? { Status: 0, AD: true }
          : { Status: 0 },
    );

    const now = new Date("2024-01-01T00:00:00.000Z");
    const data = await fetchDnsRecords("example.com", now);

    expect(data.records).toHaveLength(1);
    expect(data.dnssec.status).toBe("secure");
    // No DS/DNSKEY TTL, so the default DNS TTL (1h) applies
    expect(data.dnssecExpiresAt).toBe("2024-01-01T01:00:00.000Z");

    const recordQueries = requests.filter((r) => ["A", "AAAA", "MX", "TXT", "NS"].includes(r.type));
    expect(recordQueries.length).toBeGreaterThan(0);
    expect(recordQueries.every((r) => r.cd)).toBe(true);
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
});
