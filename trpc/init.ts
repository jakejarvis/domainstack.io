import { SpanStatusCode, trace } from "@opentelemetry/api";
import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { after } from "next/server";
import superjson from "superjson";
import { updateLastAccessed } from "@/lib/db/repos/domains";
import { getOrGenerateCorrelationId } from "@/lib/logger/correlation";

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

  // Extract correlation ID from header (set by middleware)
  // Fallback to generation if missing (tests, scripts, non-middleware scenarios)
  let correlationId: string | undefined;
  try {
    const headerList = await headers();
    correlationId = getOrGenerateCorrelationId(headerList);
  } catch {
    // headers() not available (tests/scripts)
  }

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

  return { req, ip, correlationId, session } as const;
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
 * Creates OpenTelemetry spans for distributed tracing and performance monitoring.
 * All logs are structured JSON with OpenTelemetry tracing and correlation IDs.
 * Errors are tracked in PostHog for centralized monitoring.
 */
const withLogging = t.middleware(async ({ path, type, input, next, ctx }) => {
  const start = performance.now();

  // Import logger and correlation utilities (dynamic to avoid circular deps)
  const { logger, withCorrelationId } = await import("@/lib/logger/server");
  const { generateCorrelationId } = await import("@/lib/logger/correlation");

  // Get correlation ID from context (set in createContext), or generate if missing
  const correlationId = ctx.correlationId ?? generateCorrelationId();

  // Create OpenTelemetry span for distributed tracing using startActiveSpan
  const tracer = trace.getTracer("trpc");

  // Wrap the entire procedure execution in correlation ID context and span context
  return withCorrelationId(correlationId, async () => {
    return await tracer.startActiveSpan(
      `trpc.${path}`,
      {
        attributes: {
          "trpc.path": path,
          "trpc.type": type,
          "app.correlation_id": correlationId, // Link correlation ID to trace
        },
      },
      async (span) => {
        // Log procedure start
        logger.info("procedure start", {
          source: "trpc",
          path,
          type,
          input: input && typeof input === "object" ? { ...input } : undefined,
        });

        try {
          const result = await next();
          const durationMs = Math.round(performance.now() - start);

          // Add span attributes for successful completion
          span.setAttribute("trpc.duration_ms", durationMs);
          span.setAttribute("trpc.status", "ok");
          span.setStatus({ code: SpanStatusCode.OK });

          // Log successful completion
          logger.info("procedure ok", {
            source: "trpc",
            path,
            type,
            durationMs,
            input:
              input && typeof input === "object" ? { ...input } : undefined,
          });

          // Track slow requests (>5s threshold) in PostHog
          if (durationMs > 5000) {
            span.setAttribute("trpc.slow_request", true);
            logger.warn("slow request", {
              source: "trpc",
              path,
              type,
              durationMs,
            });

            const { analytics } = await import("@/lib/analytics/server");
            analytics.track("trpc_slow_request", {
              path,
              type,
              durationMs,
            });
          }

          return result;
        } catch (err) {
          const durationMs = Math.round(performance.now() - start);

          // Record exception and set error status on span
          span.recordException(err as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.message : String(err),
          });
          span.setAttribute("trpc.duration_ms", durationMs);
          span.setAttribute("trpc.status", "error");

          // Log error with full details
          logger.error("procedure error", err, {
            source: "trpc",
            path,
            type,
            durationMs,
          });

          // Re-throw the error to be handled by the error boundary
          throw err;
        } finally {
          span.end();
        }
      },
    );
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
    const { logger } = await import("@/lib/logger/server");
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
