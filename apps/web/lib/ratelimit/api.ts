import { ipAddress } from "@vercel/functions";

import { createLogger } from "@domainstack/logger";
import { enforceRateLimit, RateLimitError } from "@domainstack/redis/enforce";
import {
  DEFAULT_RATE_LIMIT,
  type RateLimitConfig,
  type RateLimitInfo,
} from "@domainstack/redis/ratelimit";

const logger = createLogger({ source: "ratelimit/api" });

/**
 * Rate limit headers to include in responses.
 */
type RateLimitHeaders = {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
};

type RateLimitSuccess = {
  success: true;
  headers?: RateLimitHeaders;
  info?: RateLimitInfo;
};

type RateLimitFailure = {
  success: false;
  error: Response;
};

/**
 * Build rate limit headers from info.
 */
function buildHeaders(info: RateLimitInfo): RateLimitHeaders {
  return {
    "X-RateLimit-Limit": info.limit.toString(),
    "X-RateLimit-Remaining": info.remaining.toString(),
    "X-RateLimit-Reset": info.reset.toString(),
  };
}

/**
 * Resolve rate limit identifier from request.
 *
 * Priority:
 * 1. Authenticated user ID (more accurate per-user limits)
 * 2. Client IP address (fallback for anonymous requests)
 *
 * @param request - The incoming request
 * @returns User ID, IP address, or null if neither available
 */
async function resolveIdentifier(request: Request): Promise<string | null> {
  // Try to get user ID from session
  try {
    const { auth } = await import("@domainstack/auth/server");
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch (err) {
    // Auth not available or error - fall back to IP
    logger.debug({ err }, "auth session check failed, using IP");
  }

  // Fall back to IP address
  return ipAddress(request) ?? null;
}

/**
 * Check rate limit for an API route request.
 *
 * Rate limit key priority:
 * 1. Authenticated user ID (more accurate per-user limits)
 * 2. Client IP address (fallback for anonymous requests)
 *
 * Fail-open strategy:
 * - No identifier available: Allow request (skip rate limiting)
 * - Redis timeout/error: Allow request (handled by library)
 *
 * @param request - The incoming request
 * @param config - Optional rate limit configuration (defaults to 60 req/min)
 * @returns Success with headers to apply, or failure with pre-built 429 Response
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const rateLimit = await checkRateLimit(request);
 *
 *   if (!rateLimit.success) {
 *     return rateLimit.error;
 *   }
 *
 *   // Include rate limit headers in successful response
 *   return Response.json(data, {
 *     headers: rateLimit.headers,
 *   });
 * }
 *
 * // With custom config for expensive operations
 * export async function POST(request: Request) {
 *   const rateLimit = await checkRateLimit(request, {
 *     requests: 10,
 *     window: "1 m",
 *   });
 *   // ...
 * }
 * ```
 */
type CheckRateLimitConfig = RateLimitConfig & {
  /**
   * Pre-resolved identifier (user ID). Skips the session lookup.
   * Pass `null` when the caller already knows the request is anonymous.
   */
  identifier?: string | null;
};

export async function checkRateLimit(
  request: Request,
  config: CheckRateLimitConfig = DEFAULT_RATE_LIMIT,
): Promise<RateLimitSuccess | RateLimitFailure> {
  const { identifier: providedIdentifier, ...rateLimitConfig } = config;

  // Resolve identifier: caller-provided, user ID (preferred), or IP (fallback)
  const baseIdentifier =
    providedIdentifier !== undefined
      ? (providedIdentifier ?? ipAddress(request) ?? null)
      : await resolveIdentifier(request);

  // `name` isolates per-endpoint buckets; unnamed callers share the "api" bucket
  try {
    const info = await enforceRateLimit({
      key: rateLimitConfig.name || "api",
      identifier: baseIdentifier,
      config: rateLimitConfig,
    });
    return info ? { success: true, headers: buildHeaders(info), info } : { success: true };
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({ error: "Rate limit exceeded", retryAfter: err.retryAfter }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              ...buildHeaders(err.rateLimit),
              "Retry-After": err.retryAfter.toString(),
            },
          },
        ),
      };
    }
    // Fail open: an unexpected error must not block the request
    logger.error({ err }, "rate limit check failed, allowing request");
    return { success: true };
  }
}
