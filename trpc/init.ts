import { initTRPC, TRPCError } from "@trpc/server";
import { ipAddress } from "@vercel/functions";
import { headers } from "next/headers";
import { after } from "next/server";
import superjson from "superjson";
import { updateLastAccessed } from "@/lib/db/repos/domains";
import { createLogger } from "@/lib/logger/server";
import {
  getRateLimiter,
  type RateLimitConfig,
  type RateLimitInfo,
} from "@/lib/ratelimit";

/**
 * Procedure metadata for configuring middleware behavior.
 */
type ProcedureMeta = {
  /**
   * Rate limit configuration for this procedure.
   * Defaults to 60 requests/minute if not specified.
   *
   * @example
   * ```ts
   * .meta({ rateLimit: { requests: 10, window: "1 m" } })
   * ```
   */
  rateLimit?: RateLimitConfig;
};

export const createContext = async (opts?: { req?: Request }) => {
  const req = opts?.req;
  const ip = req ? (ipAddress(req) ?? null) : null;

  // Get session if available (lazy-loaded to avoid circular deps)
  let session: { user: { id: string; name: string; email: string } } | null =
    null;
  try {
    const { auth } = await import("@/lib/auth");
    const headerList = await headers();
    const authSession = await auth.api.getSession({
      headers: headerList,
    });
    if (authSession?.user) {
      session = {
        user: {
          id: authSession.user.id,
          name: authSession.user.name,
          email: authSession.user.email,
        },
      };
    }
  } catch {
    // Auth not available or error - session remains null
  }

  return { req, ip, session } as const;
};

export type Context = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<Context>().meta<ProcedureMeta>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
// biome-ignore lint/nursery/useDestructuring: this is easier
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware to log the start, end, and duration of a procedure.
 * Logs are automatically structured in JSON format.
 * Errors are tracked in PostHog for centralized monitoring.
 */
const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();

  const procedureLogger = createLogger({ source: "trpc", path, type });

  try {
    const result = await next();

    // Track slow requests (>5s threshold) in PostHog
    const durationMs = Math.round(performance.now() - start);
    if (durationMs > 5000) {
      procedureLogger.info({ durationMs }, "slow request");

      const { analytics } = await import("@/lib/analytics/server");
      // Explicitly void the promise to avoid unhandled rejection warnings
      void analytics.track("trpc_slow_request", {
        path,
        type,
        durationMs,
      });
    }

    return result;
  } catch (err) {
    // Log error and re-throw
    procedureLogger.error(err);
    throw err;
  }
});

/**
 * Middleware to enforce rate limiting based on client IP.
 *
 * Reads rate limit config from procedure meta.
 * Configure per-procedure: `.meta({ rateLimit: { requests: 10, window: "1 m" } })`
 *
 * Fail-open strategy:
 * - No IP available: Skip rate limiting, allow request
 * - Redis timeout/error: Allow request (handled by library with 2s timeout)
 *
 * On success, adds rate limit info to context for downstream use.
 * On failure, throws TOO_MANY_REQUESTS with retry timing.
 */
const withRateLimit = t.middleware(async ({ ctx, meta, next }) => {
  // Fail open: no IP = skip rate limiting entirely
  if (!ctx.ip) {
    return next();
  }

  const limiter = getRateLimiter(meta?.rateLimit);
  const { success, limit, remaining, reset, pending } = await limiter.limit(
    ctx.ip,
  );

  // Handle analytics write in background (non-blocking)
  after(() => void pending);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in ${retryAfter}s`,
    });
  }

  return next({
    ctx: {
      ...ctx,
      rateLimit: { limit, remaining, reset } satisfies RateLimitInfo,
    },
  });
});

/**
 * Middleware to record that a domain was accessed by a user (for decay calculation).
 * Expects input to have a `domain` field.
 * Schedules the write to happen after the response is sent using Next.js after().
 */
const withDomainAccessUpdate = t.middleware(async ({ input, next }) => {
  // Check if input is a valid object with a domain property
  if (
    input &&
    typeof input === "object" &&
    "domain" in input &&
    typeof input.domain === "string"
  ) {
    after(() => {
      void updateLastAccessed(input.domain as string).catch(() => {
        // no-op - access tracking should never break the request
      });
    });
  }
  return next();
});

/**
 * Public procedure with logging.
 * Use this for all public endpoints (e.g. health check, etc).
 */
export const publicProcedure = t.procedure.use(withLogging);

/**
 * Rate-limited procedure for public endpoints exposed to external consumers.
 * Use this for MCP tools, public APIs, and other endpoints that need throttling.
 *
 * Fail-open: Requests without identifiable IP are allowed without rate limiting.
 */
export const rateLimitedProcedure = publicProcedure.use(withRateLimit);

/**
 * Domain-specific procedure with "last accessed at" tracking.
 * Use this for all domain data endpoints (dns, hosting, seo, etc).
 */
export const domainProcedure = publicProcedure.use(withDomainAccessUpdate);

/**
 * Middleware to ensure user is authenticated.
 * Throws UNAUTHORIZED if no valid session.
 */
const withAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

/**
 * Middleware to ensure user has Pro subscription.
 * Throws FORBIDDEN if user is on free tier.
 */
const withProTier = t.middleware(async (opts) => {
  const { getUserSubscription } = await import(
    "@/lib/db/repos/user-subscription"
  );

  // Type assertion needed because middleware chaining doesn't preserve extended context types
  const ctx = opts.ctx as typeof opts.ctx & { user: { id: string } };
  const subscription = await getUserSubscription(ctx.user.id);

  if (subscription.plan !== "pro") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires a Pro subscription",
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      subscription,
    },
  });
});

/**
 * Protected procedure requiring authentication.
 * Use this for all endpoints that require a logged-in user.
 */
export const protectedProcedure = publicProcedure.use(withAuth);

/**
 * Pro-only procedure requiring Pro subscription.
 * Use this for endpoints that should only be accessible to Pro users.
 */
export const proOnlyProcedure = protectedProcedure.use(withProTier);
