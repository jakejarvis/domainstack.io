/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DNS_TYPE_NUMBERS } from "@domainstack/constants";

type Answer = { name: string; type: number; TTL: number; data: string };

const mocks = vi.hoisted(() => ({
  queryDohProvider: vi.fn<(provider: unknown, domain: string, type: string) => Promise<Answer[]>>(),
}));

vi.mock("./doh", () => ({
  providerOrderForLookup: () => [{ key: "cloudflare", url: "https://doh.test/dns-query" }],
  queryDohProvider: mocks.queryDohProvider,
}));
vi.mock("../lib/cloudflare", () => ({ isCloudflareIp: async () => false }));

const { fetchDnsRecords } = await import("./fetch");

function answersByType(byType: Partial<Record<string, Answer[]>>) {
  mocks.queryDohProvider.mockImplementation(async (_provider, _domain, type) => byType[type] ?? []);
}

describe("fetchDnsRecords", () => {
  beforeEach(() => {
    mocks.queryDohProvider.mockReset();
  });

  it("queries CNAME and normalizes its target like NS", async () => {
    answersByType({
      A: [
        // A resolver answering an A query for an alias includes the CNAME hop.
        {
          name: "api.example.com.",
          type: DNS_TYPE_NUMBERS.CNAME,
          TTL: 300,
          data: "Edge.CDN.test.",
        },
        { name: "edge.cdn.test.", type: DNS_TYPE_NUMBERS.A, TTL: 60, data: "192.0.2.1" },
      ],
      CNAME: [
        {
          name: "api.example.com.",
          type: DNS_TYPE_NUMBERS.CNAME,
          TTL: 300,
          data: "Edge.CDN.test.",
        },
      ],
      NS: [
        { name: "example.com.", type: DNS_TYPE_NUMBERS.NS, TTL: 3600, data: "NS1.Example.NET." },
      ],
    });

    const { records } = await fetchDnsRecords("api.example.com");

    expect(mocks.queryDohProvider).toHaveBeenCalledWith(
      expect.anything(),
      "api.example.com",
      "CNAME",
    );
    // The CNAME appears once (not duplicated from the A answer), after A/AAAA.
    expect(records).toEqual([
      { type: "A", name: "edge.cdn.test", value: "192.0.2.1", ttl: 60, isCloudflare: false },
      { type: "CNAME", name: "api.example.com", value: "edge.cdn.test", ttl: 300 },
      { type: "NS", name: "example.com", value: "ns1.example.net", ttl: 3600 },
    ]);
  });

  it("keeps CNAME in the records persisted with expiry", async () => {
    answersByType({
      CNAME: [
        { name: "www.example.com.", type: DNS_TYPE_NUMBERS.CNAME, TTL: 120, data: "example.com." },
      ],
    });

    const { recordsWithExpiry } = await fetchDnsRecords("www.example.com");

    expect(recordsWithExpiry).toEqual([
      expect.objectContaining({
        type: "CNAME",
        name: "www.example.com",
        value: "example.com",
        ttl: 120,
      }),
    ]);
  });
});
