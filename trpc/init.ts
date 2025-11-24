import { initTRPC } from "@trpc/server";
import { headers } from "next/headers";
import { after } from "next/server";
import superjson from "superjson";
import { updateLastAccessed } from "@/lib/db/repos/domains";
import { toRegistrableDomain } from "@/lib/domain-server";
import { getOrGenerateCorrelationId } from "@/lib/logger/correlation";
import { setCorrelationId } from "@/lib/logger/server";

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

  // Generate or extract correlation ID for request tracing
  let correlationId: string | undefined;
  try {
    const headerList = await headers();
    correlationId = getOrGenerateCorrelationId(headerList);
    // Set in AsyncLocalStorage for propagation
    setCorrelationId(correlationId);
  } catch {
    // headers() not available (tests/scripts)
  }

  return { req, ip, correlationId } as const;
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
 * All logs are structured JSON with OpenTelemetry tracing and correlation IDs.
 * Errors are tracked in PostHog for centralized monitoring.
 */
const withLogging = t.middleware(async ({ path, type, input, next }) => {
  const start = performance.now();

  // Import logger (dynamic to avoid circular deps)
  const { logger } = await import("@/lib/logger/server");

  // Log procedure start
  logger.debug(`[trpc] start ${path}`, {
    path,
    type,
    ...(input && typeof input === "object" ? { ...input } : {}),
  });

  try {
    const result = await next();
    const durationMs = Math.round(performance.now() - start);

    // Log successful completion
    logger.info(`[trpc] ok ${path}`, {
      path,
      type,
      durationMs,
    });

    // Track slow requests (>5s threshold) in PostHog
    if (durationMs > 5000) {
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
    const error = err instanceof Error ? err : new Error(String(err));

    // Log error with full details
    logger.error(`[trpc] error ${path}`, error, {
      path,
      type,
      durationMs,
    });

    throw err;
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
    const registrable = toRegistrableDomain(input.domain);
    if (registrable) {
      const { logger } = await import("@/lib/logger/server");
      logger.debug("[trpc] recording access for domain", {
        domain: registrable,
      });
      after(() => updateLastAccessed(registrable));
    }
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
