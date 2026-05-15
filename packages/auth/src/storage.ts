import type { Redis } from "@domainstack/redis";

/**
 * Secondary storage interface expected by Better Auth.
 */
export type SecondaryStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

/**
 * Creates a Redis-based secondary storage adapter for Better Auth.
 * Used for session caching and rate limiting.
 *
 * @param redis - Upstash Redis client instance, or null to disable
 * @returns SecondaryStorage adapter or undefined if redis is null
 *
 * @example
 * ```ts
 * const storage = createRedisStorage(redis);
 * const auth = betterAuth({
 *   secondaryStorage: storage,
 *   // ...
 * });
 * ```
 */
export function createRedisStorage(redis: Redis | null): SecondaryStorage | undefined {
  if (!redis) return undefined;

  // Pass the Redis client created with `automaticDeserialization: false` so
  // Better Auth's opaque JSON strings round-trip verbatim — no parse/stringify.
  return {
    get: async (key: string) => {
      return (await redis.get<string>(key)) ?? null;
    },
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) {
        await redis.set<string>(key, value, { ex: ttl });
      } else {
        await redis.set<string>(key, value);
      }
    },
    delete: async (key: string) => {
      await redis.del(key);
    },
  };
}
