import { describe, expect, it, vi } from "vitest";

import type { Redis } from "@domainstack/redis";

import { createRedisStorage } from "./storage";

function mockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn<(key: string) => Promise<string | null>>(async (key) => store.get(key) ?? null),
    set: vi.fn<(key: string, value: string, opts?: { ex: number }) => Promise<string>>(
      async (key, value) => {
        store.set(key, value);
        return "OK";
      },
    ),
    del: vi.fn<(key: string) => Promise<number>>(async (key) => {
      store.delete(key);
      return 1;
    }),
  };
}

describe("createRedisStorage", () => {
  it("returns undefined when no redis client is supplied", () => {
    expect(createRedisStorage(null)).toBeUndefined();
  });

  it("round-trips opaque JSON strings verbatim (no parse/stringify)", async () => {
    const redis = mockRedis();
    const storage = createRedisStorage(redis as unknown as Redis)!;

    const sessionJson = JSON.stringify({ session: { id: "s1" }, user: { id: "u1" } });
    await storage.set("token", sessionJson);

    // Stored exactly as given — not double-encoded.
    expect(redis.set).toHaveBeenCalledWith("token", sessionJson);
    // Read back byte-for-byte identical to what Better Auth wrote.
    await expect(storage.get("token")).resolves.toBe(sessionJson);
  });

  it("forwards ttl as an expiry option", async () => {
    const redis = mockRedis();
    const storage = createRedisStorage(redis as unknown as Redis)!;

    await storage.set("rl", "1", 60);
    expect(redis.set).toHaveBeenCalledWith("rl", "1", { ex: 60 });
  });

  it("returns null for a missing key", async () => {
    const redis = mockRedis();
    const storage = createRedisStorage(redis as unknown as Redis)!;
    await expect(storage.get("nope")).resolves.toBeNull();
  });

  it("deletes via the underlying client", async () => {
    const redis = mockRedis();
    const storage = createRedisStorage(redis as unknown as Redis)!;

    await storage.set("k", "v");
    await storage.delete("k");
    expect(redis.del).toHaveBeenCalledWith("k");
    await expect(storage.get("k")).resolves.toBeNull();
  });
});
