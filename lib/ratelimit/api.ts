import { waitUntil } from "@vercel/functions";
import { type RateLimitInfo, ratelimit } from "./index";

/**
 * Rate limit headers to include in responses.
 */
export type RateLimitHeaders = {
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
 * Check rate limit for an API route request.
 *
 * Fail-open strategy:
 * - No IP provided: Allow request (skip rate limiting)
 * - Redis timeout/error: Allow request (handled by library)
 *
 * @param ip - Client IP address, or undefined/null if unavailable
 * @returns Success with headers to apply, or failure with pre-built 429 Response
 *
 * @example
 * ```ts
 * import { ipAddress } from "@vercel/functions";
 *
 * export async function GET(request: Request) {
 *   const rateLimit = await checkRateLimit(ipAddress(request));
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
 * ```
 */
export async function checkRateLimit(
  ip: string | null | undefined,
): Promise<RateLimitSuccess | RateLimitFailure> {
  // Fail open: no IP = allow request without rate limiting
  if (!ip) {
    return { success: true };
  }

  const { success, limit, remaining, reset, pending } =
    await ratelimit.limit(ip);

  // Handle analytics write in background (non-blocking)
  waitUntil(pending);

  const info = { limit, remaining, reset };

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return {
      success: false,
      error: new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...buildHeaders(info),
            "Retry-After": retryAfter.toString(),
          },
        },
      ),
    };
  }

  return {
    success: true,
    headers: buildHeaders(info),
    info,
  };
}
