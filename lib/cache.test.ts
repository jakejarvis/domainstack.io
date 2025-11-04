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
    const lockKey = ns("lock", "test", "asset");

    // seed cache
    await (await import("@/lib/redis")).redis.set(indexKey, {
      url: "https://cdn/x.webp",
    });

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      lockKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({
        url: "https://cdn/y.webp",
        key: "k",
        metrics: { source: "upload" },
      }),
    });

    expect(result).toEqual({ url: "https://cdn/x.webp" });
  });

  it("waits for result when lock not acquired and cached result exists", async () => {
    const indexKey = ns("test", "asset2");
    const lockKey = ns("lock", "test", "asset2");

    // Simulate another worker already storing result
    const { redis } = await import("@/lib/redis");
    await redis.set(lockKey, "1");
    await redis.set(indexKey, { url: "https://cdn/wait.webp" });

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      lockKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({ url: "https://cdn/unused.webp" }),
    });

    expect(result).toEqual({ url: "https://cdn/wait.webp" });
  });

  it("produces, stores, and returns new asset under lock", async () => {
    const indexKey = ns("test", "asset3");
    const lockKey = ns("lock", "test", "asset3");

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      lockKey,
      ttlSeconds: 60,
      purgeQueue: "purge-test",
      produceAndUpload: async () => ({
        url: "https://cdn/new.webp",
        key: "object-key",
        metrics: { source: "upload" },
      }),
    });

    expect(result).toEqual({ url: "https://cdn/new.webp" });

    const { redis } = await import("@/lib/redis");
    const stored = (await redis.get(indexKey)) as {
      url?: string;
      key?: string;
    } | null;
    expect(stored?.url).toBe("https://cdn/new.webp");
  });

  it("propagates not_found via cached null", async () => {
    const indexKey = ns("test", "asset4");
    const lockKey = ns("lock", "test", "asset4");

    const result = await getOrCreateCachedAsset<{ source: string }>({
      indexKey,
      lockKey,
      ttlSeconds: 60,
      produceAndUpload: async () => ({ url: null }),
    });

    expect(result).toEqual({ url: null });
  });

  it("schedules blob deletion with grace period beyond Redis TTL", async () => {
    const indexKey = ns("test", "grace-test");
    const lockKey = ns("lock", "grace-test");
    const purgeQueue = "test-queue";
    const ttl = 60; // 1 minute
    const gracePeriod = 300; // 5 minutes

    const beforeMs = Date.now();

    await getOrCreateCachedAsset({
      indexKey,
      lockKey,
      ttlSeconds: ttl,
      purgeQueue,
      blobGracePeriodSeconds: gracePeriod,
      produceAndUpload: async () => ({
        url: "https://cdn/grace.webp",
        key: "grace-key",
      }),
    });

    const afterMs = Date.now();

    const { redis } = await import("@/lib/redis");
    const purgeKey = ns("purge", purgeQueue);
    const members = (await redis.zrange(purgeKey, 0, -1)) as string[];

    expect(members).toHaveLength(1);
    expect(members[0]).toBe("https://cdn/grace.webp");

    const scheduledDeleteMs = await redis.zscore(purgeKey, members[0]);
    expect(scheduledDeleteMs).not.toBeNull();

    const expectedMinMs = beforeMs + (ttl + gracePeriod) * 1000;
    const expectedMaxMs = afterMs + (ttl + gracePeriod) * 1000;

    expect(scheduledDeleteMs).toBeGreaterThanOrEqual(expectedMinMs);
    expect(scheduledDeleteMs).toBeLessThanOrEqual(expectedMaxMs);
  });

  it("uses 24-hour default grace period when not specified", async () => {
    const indexKey = ns("test", "default-grace");
    const lockKey = ns("lock", "default-grace");
    const purgeQueue = "default-queue";
    const ttl = 3600; // 1 hour

    const beforeMs = Date.now();

    await getOrCreateCachedAsset({
      indexKey,
      lockKey,
      ttlSeconds: ttl,
      purgeQueue,
      // No blobGracePeriodSeconds specified - should default to 86400 (24 hours)
      produceAndUpload: async () => ({
        url: "https://cdn/default.webp",
      }),
    });

    const afterMs = Date.now();

    const { redis } = await import("@/lib/redis");
    const purgeKey = ns("purge", purgeQueue);
    const members = (await redis.zrange(purgeKey, 0, -1)) as string[];

    expect(members).toHaveLength(1);
    const scheduledDeleteMs = await redis.zscore(purgeKey, members[0]);
    expect(scheduledDeleteMs).not.toBeNull();

    const defaultGracePeriod = 86400; // 24 hours
    const expectedMinMs = beforeMs + (ttl + defaultGracePeriod) * 1000;
    const expectedMaxMs = afterMs + (ttl + defaultGracePeriod) * 1000;

    expect(scheduledDeleteMs).toBeGreaterThanOrEqual(expectedMinMs);
    expect(scheduledDeleteMs).toBeLessThanOrEqual(expectedMaxMs);
  });
});
