/* @vitest-environment node */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

let getOrCreateCachedAsset: typeof import("@/lib/cache").getOrCreateCachedAsset;

const ns = (...parts: string[]) => parts.join(":");

describe("cached assets", () => {
  beforeAll(async () => {
    const { makeInMemoryRedis } = await import("@/lib/redis-mock");
    const impl = makeInMemoryRedis();
    vi.doMock("@/lib/redis", () => impl);
    ({ getOrCreateCachedAsset } = await import("@/lib/cache"));
  });
  beforeEach(async () => {
    const { resetInMemoryRedis } = await import("@/lib/redis-mock");
    resetInMemoryRedis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cached URL on hit", async () => {
    const indexKey = ns("test", "asset");

    // seed cache
    await (await import("@/lib/redis")).redis.set(indexKey, {
      url: "https://cdn/x.webp",
    });

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({
        url: "https://cdn/y.webp",
        key: "k",
        metrics: { source: "upload" },
      }),
    });

    expect(result).toEqual({ url: "https://cdn/x.webp" });
  });

  it("generates asset when cache miss", async () => {
    const indexKey = ns("test", "asset2");

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({ url: "https://cdn/generated.webp" }),
    });

    expect(result).toEqual({ url: "https://cdn/generated.webp" });
  });

  it("produces, stores, and returns new asset", async () => {
    const indexKey = ns("test", "asset3");

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({
        url: "https://cdn/new.webp",
        key: "object-key",
        metrics: { source: "upload" },
      }),
    });

    expect(result).toEqual({ url: "https://cdn/new.webp" });

    // Give time for fire-and-forget cache to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    const { redis } = await import("@/lib/redis");
    const stored = (await redis.get(indexKey)) as {
      url?: string;
      key?: string;
    } | null;
    expect(stored?.url).toBe("https://cdn/new.webp");
  });

  it("retries transient failures (null without notFound flag)", async () => {
    const indexKey = ns("test", "asset4");

    // Pre-seed cache with null result WITHOUT notFound (simulating transient failure)
    const { redis } = await import("@/lib/redis");
    await redis.set(indexKey, {
      url: null,
      expiresAtMs: Date.now() + 1000,
    });

    let produceCalled = false;
    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => {
        produceCalled = true;
        return { url: "https://cdn/recovered.webp" };
      },
    });

    // Should have retried and returned new URL
    expect(result).toEqual({ url: "https://cdn/recovered.webp" });
    expect(produceCalled).toBe(true);
  });

  it("does NOT retry permanent not found (null with notFound=true)", async () => {
    const indexKey = ns("test", "asset5");

    // Pre-seed cache with permanent not found
    const { redis } = await import("@/lib/redis");
    await redis.set(indexKey, {
      url: null,
      notFound: true,
      expiresAtMs: Date.now() + 1000,
    });

    let produceCalled = false;
    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => {
        produceCalled = true;
        return { url: "https://cdn/should-not-call.webp" };
      },
    });

    // Should NOT retry and return null immediately
    expect(result).toEqual({ url: null });
    expect(produceCalled).toBe(false);
  });

  it("caches notFound flag when returned by producer", async () => {
    const indexKey = ns("test", "asset6");

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({ url: null, notFound: true }),
    });

    expect(result).toEqual({ url: null });

    // Give time for fire-and-forget cache to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // notFound flag should be stored in cache
    const { redis } = await import("@/lib/redis");
    const stored = (await redis.get(indexKey)) as {
      url?: string | null;
      notFound?: boolean;
    } | null;
    expect(stored?.url).toBe(null);
    expect(stored?.notFound).toBe(true);
  });

  it("checks DB cache (L2) on Redis miss", async () => {
    const indexKey = ns("test", "asset7");
    const dbUrl = "https://db/cached.webp";

    let fetchFromDbCalled = false;
    let produceCalled = false;

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      fetchFromDb: async () => {
        fetchFromDbCalled = true;
        return { url: dbUrl, key: "db-key" };
      },
      produceAndUpload: async () => {
        produceCalled = true;
        return { url: "https://cdn/produced.webp" };
      },
    });

    expect(result).toEqual({ url: dbUrl });
    expect(fetchFromDbCalled).toBe(true);
    expect(produceCalled).toBe(false);

    // DB result should be cached in Redis
    await new Promise((resolve) => setTimeout(resolve, 50));
    const { redis } = await import("@/lib/redis");
    const stored = (await redis.get(indexKey)) as { url?: string } | null;
    expect(stored?.url).toBe(dbUrl);
  });

  it("generates asset when both Redis and DB miss", async () => {
    const indexKey = ns("test", "asset8");

    let fetchFromDbCalled = false;
    let produceCalled = false;
    let persistToDbCalled = false;

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      fetchFromDb: async () => {
        fetchFromDbCalled = true;
        return null; // DB miss
      },
      produceAndUpload: async () => {
        produceCalled = true;
        return { url: "https://cdn/fresh.webp", key: "fresh-key" };
      },
      persistToDb: async (res) => {
        persistToDbCalled = true;
        expect(res.url).toBe("https://cdn/fresh.webp");
      },
    });

    expect(result).toEqual({ url: "https://cdn/fresh.webp" });
    expect(fetchFromDbCalled).toBe(true);
    expect(produceCalled).toBe(true);

    // Wait for fire-and-forget to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(persistToDbCalled).toBe(true);
  });

  it("skips DB callbacks when not provided", async () => {
    const indexKey = ns("test", "asset9");

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({
        url: "https://cdn/no-db.webp",
        key: "no-db",
      }),
      // fetchFromDb and persistToDb omitted
    });

    expect(result).toEqual({ url: "https://cdn/no-db.webp" });
  });

  it("handles DB fetch errors gracefully", async () => {
    const indexKey = ns("test", "asset10");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      fetchFromDb: async () => {
        throw new Error("DB connection failed");
      },
      produceAndUpload: async () => ({
        url: "https://cdn/fallback.webp",
      }),
    });

    expect(result).toEqual({ url: "https://cdn/fallback.webp" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[cache] db read failed"),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it("handles DB persist errors gracefully", async () => {
    const indexKey = ns("test", "asset11");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({
        url: "https://cdn/persist-fail.webp",
      }),
      persistToDb: async () => {
        throw new Error("DB write failed");
      },
    });

    expect(result).toEqual({ url: "https://cdn/persist-fail.webp" });

    // Wait for fire-and-forget to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[cache] db persist error"),
      expect.any(Object),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });
});
