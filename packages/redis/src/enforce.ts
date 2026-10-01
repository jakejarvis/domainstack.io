import { waitUntil } from "@vercel/functions";
import * as ipaddr from "ipaddr.js";

import { createLogger } from "@domainstack/logger";

import {
  DEFAULT_RATE_LIMIT,
  getRateLimiter,
  type RateLimitConfig,
  type RateLimitInfo,
} from "./ratelimit";

const logger = createLogger({ source: "ratelimit" });

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
 * The bucket an identifier is metered under. IPv6 clients usually control a whole
 * /64, so they are bucketed by that prefix; IPv4-mapped IPv6 becomes plain IPv4.
 * Anything that isn't an IP (a user ID) is returned unchanged.
 */
export function rateLimitBucket(identifier: string): string {
  // User IDs and hashes contain neither; skip so bare numbers aren't parsed as IPv4.
  if (!identifier.includes(".") && !identifier.includes(":")) {
    return identifier;
  }
  if (!ipaddr.isValid(identifier)) {
    return identifier;
  }
  const addr = ipaddr.parse(identifier);
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return v6.toIPv4Address().toString();
    }
    const [a, b, c, d] = v6.parts;
    return `${[a, b, c, d].map((p) => p.toString(16)).join(":")}::/64`;
  }
  return addr.toString();
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
  identifier?: string | null;
  config?: RateLimitConfig | false;
}): Promise<RateLimitInfo | undefined> {
  if (config === false || process.env.NODE_ENV === "development") {
    return undefined;
  }

  const limiter = getRateLimiter(config);
  if (!limiter || !identifier) {
    return undefined;
  }

  const result = await limiter
    .limit(`${key}:${rateLimitBucket(identifier)}`)
    .catch((err: unknown) => {
      logger.error({ err, key }, "rate limit check failed, allowing request");
      return null;
    });
  if (!result) {
    return undefined;
  }

  const { success, limit, remaining, reset, pending } = result;

  // `pending` covers any background work the limiter schedules (multi-region
  // sync); it is empty with analytics off. `waitUntil` no-ops off-platform
  // (local dev, tests) and drops it, which is fine. Swallow failures either way
  // so they can't become an unhandled rejection.
  waitUntil(pending.catch(() => undefined));

  const info = { limit, remaining, reset } satisfies RateLimitInfo;

  if (!success) {
    throw new RateLimitError(Math.max(1, Math.ceil((reset - Date.now()) / 1000)), info);
  }

  return info;
}
