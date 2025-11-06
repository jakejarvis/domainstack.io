/* @vitest-environment node */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let isCloudflareIp: typeof import("./cloudflare").isCloudflareIp;

describe("isCloudflareIp", () => {
  beforeAll(async () => {
    // Use in-memory Redis for testing
    const { makeInMemoryRedis } = await import("@/lib/redis-mock");
    const impl = makeInMemoryRedis();
    vi.doMock("@/lib/redis", () => impl);

    // Import module AFTER mocks are set up
    const module = await import("./cloudflare");
    isCloudflareIp = module.isCloudflareIp;
  });

  afterEach(async () => {
    // Reset Redis state between tests
    const { resetInMemoryRedis } = await import("@/lib/redis-mock");
    resetInMemoryRedis();
    vi.restoreAllMocks();
  });

  it("matches IPv4 and IPv6 against ranges", async () => {
    // Mock fetch of CF ranges
    const body = (data: unknown) =>
      new Response(JSON.stringify(data), { status: 200 });
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () =>
      body({
        result: {
          ipv4_cidrs: ["1.2.3.0/24"],
          ipv6_cidrs: ["2001:db8::/32"],
        },
      }),
    );

    expect(await isCloudflareIp("1.2.3.4")).toBe(true);
    expect(await isCloudflareIp("5.6.7.8")).toBe(false);
    expect(await isCloudflareIp("2001:db8::1")).toBe(true);
    expect(await isCloudflareIp("2001:dead::1")).toBe(false);

    // Verify fetch was called only once (subsequent calls should use Redis cache)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockRestore();
  });

  it("uses Redis cache for subsequent requests", async () => {
    const body = (data: unknown) =>
      new Response(JSON.stringify(data), { status: 200 });
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () =>
      body({
        result: {
          ipv4_cidrs: ["1.2.3.0/24"],
          ipv6_cidrs: ["2001:db8::/32"],
        },
      }),
    );

    // First call should fetch from API
    await isCloudflareIp("1.2.3.4");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call should use Redis cache (React cache() only dedups within same request)
    // Note: In real scenarios, React's cache() would reset between requests,
    // but Redis cache would persist
    await isCloudflareIp("1.2.3.5");
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still only 1 fetch

    fetchMock.mockRestore();
  });
});
