/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { lookupGeoIp } from "./geoip";

afterEach(() => {
  server.resetHandlers();
});

describe("lookupGeoIp", () => {
  it("parses ipwho.is response and derives owner and domain", async () => {
    // 1.1.1.1 is mocked in @/mocks/handlers.ts with Cloudflare data
    const res = await lookupGeoIp("1.1.1.1");
    expect(res.geo.city).toBe("San Francisco");
    expect(res.owner).toBe("Cloudflare, Inc.");
    expect(res.domain).toBe("cloudflare.com");
  });

  it("returns defaults on error", async () => {
    // Force network error
    server.use(http.get("https://ipwho.is/:ip", () => HttpResponse.error()));

    const res = await lookupGeoIp("1.2.3.4");
    expect(res.owner).toBeNull();
    expect(res.geo.country).toBe("");
    expect(res.domain).toBeNull();
  });
});
