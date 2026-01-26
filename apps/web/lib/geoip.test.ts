/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { lookupGeoIp } from "./geoip";

beforeAll(() => {
  // Stub the API key for tests
  vi.stubEnv("IPLOCATE_API_KEY", "test-api-key");
});

afterEach(() => {
  server.resetHandlers();
});

describe("lookupGeoIp", () => {
  it("parses iplocate.io response and derives owner and domain", async () => {
    // 1.1.1.1 is mocked in @/mocks/handlers.ts with Cloudflare data
    const res = await lookupGeoIp("1.1.1.1");
    expect(res.geo?.city).toBe("San Francisco");
    expect(res.owner).toBe("Cloudflare, Inc.");
    expect(res.domain).toBe("cloudflare.com");
  });

  it("returns defaults on error", async () => {
    // Force network error
    server.use(
      http.get("https://www.iplocate.io/api/lookup/:ip", () =>
        HttpResponse.error(),
      ),
    );

    const res = await lookupGeoIp("1.2.3.4");
    expect(res.owner).toBeNull();
    expect(res.domain).toBeNull();
    expect(res.geo?.country).toBeUndefined();
  });
});
