import type { SecondaryStorage } from "better-auth";

import type { Redis } from "@domainstack/redis";

export type { SecondaryStorage };

/**
 * Creates a Redis-based secondary storage adapter for Better Auth.
 * Used for session caching and rate limiting.
 *
 * `increment` is required for atomic rate-limit `consume`. `getAndDelete` is
 * required for atomic single-use verification tokens.
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

  return {
    get(key) {
      return redis.get(key);
    },
    getAndDelete(key) {
      return redis.getdel(key);
    },
    async increment(key, ttl) {
      if (!Number.isInteger(ttl) || ttl <= 0) {
        throw new TypeError("Redis increment TTL must be a positive integer");
      }

      // INCR then EXPIRE NX so the window is fixed from first creation and
      // never extended by later traffic. See:
      // https://www.better-auth.com/docs/concepts/database#redis-storage
      const [value] = await redis.multi().incr(key).expire(key, ttl, "NX").exec();

      return value;
    },
    async set(key, value, ttl) {
      if (ttl) {
        await redis.set(key, value, { ex: ttl });
      } else {
        await redis.set(key, value);
      }
    },
    async delete(key) {
      await redis.del(key);
    },
  };
}
