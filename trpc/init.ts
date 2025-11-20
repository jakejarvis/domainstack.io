import { initTRPC } from "@trpc/server";
import { headers } from "next/headers";
import { after } from "next/server";
import superjson from "superjson";
import { updateLastAccessed } from "@/lib/db/repos/domains";
import { toRegistrableDomain } from "@/lib/domain-server";

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

  return { req, ip } as const;
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
 * All logs are structured JSON for better parsing by log aggregators.
 * Errors are tracked in PostHog for centralized monitoring.
 * @param path - The path of the procedure
 * @param type - The type of the procedure
 * @param input - The input to the procedure
 * @param next - The next middleware
 * @returns The result of the next middleware
 */
const withLogging = t.middleware(async ({ path, type, input, next }) => {
  const start = performance.now();

  // Sample input for debugging (only log safe fields, avoid PII)
  const inputSample =
    input && typeof input === "object"
      ? Object.keys(input).reduce(
          (acc, key) => {
            // Log only safe fields, truncate long values
            if (
              key === "domain" ||
              key === "type" ||
              key === "types" ||
              key === "limit"
            ) {
              const value = (input as Record<string, unknown>)[key];
              acc[key] = String(value).slice(0, 100);
            }
            return acc;
          },
          {} as Record<string, string>,
        )
      : undefined;

  console.debug(
    JSON.stringify({
      level: "debug",
      message: "[trpc] start",
      path,
      type,
      input: inputSample,
      timestamp: new Date().toISOString(),
    }),
  );

  try {
    const result = await next();
    const durationMs = Math.round(performance.now() - start);

    console.info(
      JSON.stringify({
        level: "info",
        message: "[trpc] ok",
        path,
        type,
        durationMs,
        timestamp: new Date().toISOString(),
      }),
    );

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

    console.error(
      JSON.stringify({
        level: "error",
        message: "[trpc] error",
        path,
        type,
        durationMs,
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: error.cause,
        },
      }),
    );

    // Track exceptions in PostHog for centralized monitoring
    const { analytics } = await import("@/lib/analytics/server");
    analytics.trackException(error, {
      path,
      type,
      durationMs,
      source: "trpc",
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
      console.debug(
        JSON.stringify({
          level: "debug",
          message: "[trpc] recording access for domain",
          domain: registrable,
          timestamp: new Date().toISOString(),
        }),
      );
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
