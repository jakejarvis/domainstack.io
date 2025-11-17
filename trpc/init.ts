import { initTRPC } from "@trpc/server";
import { ipAddress } from "@vercel/functions";
import { after } from "next/server";
import superjson from "superjson";
import { updateLastAccessed } from "@/lib/db/repos/domains";
import { toRegistrableDomain } from "@/lib/domain-server";
import { assertRateLimit, type ServiceName } from "@/lib/ratelimit";

export const createContext = async (opts?: { req?: Request }) => {
  const req = opts?.req;
  const ip = req ? ipAddress(req) : null;

  return { ip, req } as const;
};

export type Context = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC
  .context<Context>()
  .meta<Record<string, unknown>>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      const cause = (
        error as unknown as {
          cause?: {
            retryAfter?: number;
            service?: string;
            limit?: number;
            remaining?: number;
          };
        }
      ).cause;
      return {
        ...shape,
        data: {
          ...shape.data,
          retryAfter:
            typeof cause?.retryAfter === "number"
              ? cause.retryAfter
              : undefined,
          service:
            typeof cause?.service === "string" ? cause.service : undefined,
          limit: typeof cause?.limit === "number" ? cause.limit : undefined,
          remaining:
            typeof cause?.remaining === "number" ? cause.remaining : undefined,
        },
      };
    },
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware to log the start, end, and duration of a procedure.
 * @param path - The path of the procedure
 * @param type - The type of the procedure
 * @param next - The next middleware
 * @returns The result of the next middleware
 */
const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();
  console.debug(`[trpc] start ${path} (${type})`);
  try {
    const result = await next();
    const durationMs = Math.round(performance.now() - start);
    console.info(`[trpc] ok ${path} (${type}) ${durationMs}ms`);
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(
      JSON.stringify({
        level: "error",
        message: `[trpc] error ${path} (${type})`,
        path,
        type,
        durationMs,
        error: {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        },
      }),
    );
    throw err;
  }
});

/**
 * Middleware to rate limit requests.
 * - Expects meta to have a `service` field containing the service name.
 * - Expects ctx to have an `ip` field containing the IP address.
 * - Throws a TRPCError if the rate limit is exceeded.
 */
const withRatelimit = t.middleware(async ({ ctx, next, meta }) => {
  if (meta?.service && ctx.ip) {
    await assertRateLimit(meta.service as ServiceName, ctx.ip);
  }
  return next();
});

/**
 * Middleware to record that a domain was accessed by a user (for decay calculation).
 * - Expects input to have a `domain` field.
 * - Can be disabled by setting `meta.recordAccess = false`.
 * Schedules the write to happen after the response is sent using Next.js after().
 */
const withDomainAccessUpdate = t.middleware(async ({ input, meta, next }) => {
  // Allow procedures to opt-out of access tracking
  if (meta?.recordAccess === false) {
    return next();
  }
  // Check if input is a valid object with a domain property
  if (
    input &&
    typeof input === "object" &&
    "domain" in input &&
    typeof input.domain === "string"
  ) {
    const registrable = toRegistrableDomain(input.domain);
    if (registrable) {
      console.debug(`[trpc] recording access for domain: ${registrable}`);
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
 * Domain-specific procedure with rate limiting and access tracking.
 * Use this for all domain data endpoints (dns, hosting, seo, etc).
 */
export const domainProcedure = publicProcedure
  .use(withRatelimit)
  .use(withDomainAccessUpdate);
