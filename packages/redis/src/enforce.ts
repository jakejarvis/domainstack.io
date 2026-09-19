import { waitUntil } from "@vercel/functions";

import {
  DEFAULT_RATE_LIMIT,
  getRateLimiter,
  type RateLimitConfig,
  type RateLimitInfo,
} from "./ratelimit";

/**
 * Thrown by {@link enforceRateLimit} when the caller is over budget.
 * Transport layers translate it (tRPC → TOO_MANY_REQUESTS, chat → tool message).
 */
export class RateLimitError extends Error {
  constructor(
    public readonly retryAfter: number,
    public readonly rateLimit: RateLimitInfo,
  ) {
    super(`Rate limit exceeded. Try again in ${retryAfter}s`);
    this.name = "RateLimitError";
  }
}

/**
 * Consume one token from `key`'s bucket for `identifier`.
 *
 * Fail-open: no Redis, no identifier, a Redis error/timeout, or local
 * development all skip the check. Throws {@link RateLimitError} when exceeded.
 *
 * @returns RateLimitInfo when a check ran successfully, otherwise undefined
 */
export async function enforceRateLimit({
  key,
  identifier,
  config = DEFAULT_RATE_LIMIT,
}: {
  /** Bucket name; each distinct key gets its own budget per identifier. */
  key: string;
  identifier: string | null | undefined;
  config?: RateLimitConfig | false;
}): Promise<RateLimitInfo | undefined> {
  if (config === false || process.env.NODE_ENV === "development") {
    return undefined;
  }

  const limiter = getRateLimiter(config);
  if (!limiter || !identifier) {
    return undefined;
  }

  const result = await limiter.limit(`${key}:${identifier}`).catch(() => null);
  if (!result) {
    return undefined;
  }

  const { success, limit, remaining, reset, pending } = result;

  // Analytics write lands after the response; `waitUntil` no-ops off-platform
  // (local dev, tests) and drops it, which is fine for analytics. Swallow
  // failures either way so they can't become an unhandled rejection.
  waitUntil(pending.catch(() => undefined));

  const info = { limit, remaining, reset } satisfies RateLimitInfo;

  if (!success) {
    throw new RateLimitError(Math.max(1, Math.ceil((reset - Date.now()) / 1000)), info);
  }

  return info;
}
