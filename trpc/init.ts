import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { after } from "next/server";
import superjson from "superjson";
import { updateLastAccessed } from "@/lib/db/repos/domains";
import { logger } from "@/lib/logger/server";

const IP_HEADERS = ["x-real-ip", "x-forwarded-for", "cf-connecting-ip"];

const resolveRequestIp = async () => {
  try {
    const headerList = await headers();
    for (const name of IP_HEADERS) {
      const value = headerList.get(name);
      if (value) {
        const first = value.split(",")[0]?.trim();
        if (first) {
          return first;
        }
      }
    }
  } catch {
    // headers() is only available inside Next.js request lifecycle hooks.
    // Ignore errors when invoked in tests or scripts.
  }

  return null;
};

export const createContext = async (opts?: { req?: Request }) => {
  const req = opts?.req;
  const ip = await resolveRequestIp();

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

export const t = initTRPC
  .context<Context>()
  .meta<Record<string, unknown>>()
  .create({
    transformer: superjson,
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware to log the start, end, and duration of a procedure.
 * Logs are automatically structured in JSON format.
 * Errors are tracked in PostHog for centralized monitoring.
 */
const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();

  // Log procedure start
  logger.info("procedure start", {
    source: "trpc",
    path,
    type,
  });

  try {
    const result = await next();
    const durationMs = Math.round(performance.now() - start);

    // Log successful completion
    logger.info("procedure ok", {
      source: "trpc",
      path,
      type,
      durationMs,
    });

    // Track slow requests (>5s threshold) in PostHog
    if (durationMs > 5000) {
      logger.warn("slow request", {
        source: "trpc",
        path,
        type,
        durationMs,
      });

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
    const durationMs = Math.round(performance.now() - start);

    // Normalize error for consistent logging
    // If a non-Error is thrown (string, object, etc.), wrap it in an Error
    const normalizedError = err instanceof Error ? err : new Error(String(err));

    // Build sanitized context for non-Error throws
    const errorContext: Record<string, unknown> = {
      source: "trpc",
      path,
      type,
      durationMs,
    };

    // If original value was not an Error, include sanitized preview
    if (err !== normalizedError) {
      errorContext.wrappedError = true;
      errorContext.originalType = typeof err;
      // Truncate to prevent logging huge objects
      const stringValue = String(err);
      errorContext.originalPreview =
        stringValue.length > 200
          ? `${stringValue.slice(0, 200)}...`
          : stringValue;
    }

    // Log error with sanitized details
    logger.error("procedure error", normalizedError, errorContext);

    // Always rethrow normalized Error for proper stack traces
    throw normalizedError;
  }
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
    logger.info("recording access for domain", {
      source: "trpc",
      domain: input.domain,
    });

    after(() => updateLastAccessed(input.domain as string));
  }
  return next();
});

/**
 * Public procedure with logging.
 * Use this for all public endpoints (e.g. health check, etc).
 */
export const publicProcedure = t.procedure.use(withLogging);

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
 * Protected procedure requiring authentication.
 * Use this for all endpoints that require a logged-in user.
 */
export const protectedProcedure = publicProcedure.use(withAuth);
