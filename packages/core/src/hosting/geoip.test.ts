/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";

vi.mock("@domainstack/redis", () => ({ getRedis: () => null }));

import { lookupGeoIp } from "./geoip";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("IPLOCATE_API_KEY", "test-api-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lookupGeoIp", () => {
  it("returns transformed data on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ city: "Ashburn", company: { name: "Example Co" } }), {
        status: 200,
      }),
    );
    const res = await lookupGeoIp("93.184.216.34");
    expect(res?.geo?.city).toBe("Ashburn");
    expect(res?.owner).toBe("Example Co");
  });

  it("throws RemoteDataUnavailableError on HTTP 503", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    await expect(lookupGeoIp("93.184.216.34")).rejects.toBeInstanceOf(RemoteDataUnavailableError);
  });

  it("throws RemoteDataUnavailableError on HTTP 429", async () => {
    fetchMock.mockResolvedValue(new Response("slow down", { status: 429 }));
    await expect(lookupGeoIp("93.184.216.34")).rejects.toBeInstanceOf(RemoteDataUnavailableError);
  });

  it("returns null on HTTP 404", async () => {
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    await expect(lookupGeoIp("93.184.216.34")).resolves.toBeNull();
  });

  it("returns null when the body carries an error message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid IP" }), { status: 200 }),
    );
    await expect(lookupGeoIp("93.184.216.34")).resolves.toBeNull();
  });

  it("throws RemoteDataUnavailableError when fetch throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(lookupGeoIp("93.184.216.34")).rejects.toBeInstanceOf(RemoteDataUnavailableError);
  });

  it("returns null without calling the API when no key is configured", async () => {
    vi.stubEnv("IPLOCATE_API_KEY", "");
    await expect(lookupGeoIp("93.184.216.34")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
