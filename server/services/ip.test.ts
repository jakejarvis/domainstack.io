/* @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupIpMeta } from "./ip";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupIpMeta", () => {
  it("parses ipwho.is response and derives owner", async () => {
    const resp = {
      city: "SF",
      region: "CA",
      country: "US",
      latitude: 37.7,
      longitude: -122.4,
      flag: { emoji: "🇺🇸" },
      connection: { org: "Cloudflare", isp: "Cloudflare, Inc" },
    };
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(resp), { status: 200 }));
    const res = await lookupIpMeta("1.2.3.4");
    expect(res.geo.city).toBe("SF");
    expect(res.owner).toBe("Cloudflare");
    fetchMock.mockRestore();
  });

  it("returns defaults on error", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("boom"));
    const res = await lookupIpMeta("1.2.3.4");
    expect(res.owner).toBeNull();
    expect(res.geo.country).toBe("");
    fetchMock.mockRestore();
  });
});
