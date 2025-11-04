import { initTRPC } from "@trpc/server";
import { ipAddress } from "@vercel/functions";
import superjson from "superjson";
import { recordDomainAccess } from "@/lib/access";
import { toRegistrableDomain } from "@/lib/domain-server";
import { assertRateLimit, type ServiceName } from "@/lib/ratelimit";

export const createContext = async (opts?: { req?: Request }) => {
  const req = opts?.req;
  const ip = req
    ? (ipAddress(req) ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      req.headers.get("cf-connecting-ip") ??
      null)
    : null;

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
    console.error(
      `[trpc] error ${path} (${type}) ${durationMs}ms`,
      err instanceof Error ? err : new Error(String(err)),
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
 * Middleware to record domain access for decay calculation.
 * Expects input to have a `domain` field containing the domain string.
 */
const withAccess = t.middleware(async ({ input, next }) => {
  // Extract domain from input and record access if it's a valid registrable domain
  const domain =
    typeof input === "object" &&
    input !== null &&
    "domain" in input &&
    typeof input.domain === "string"
      ? input.domain
      : null;

  if (domain) {
    const registrable = toRegistrableDomain(domain);
    if (registrable) {
      recordDomainAccess(registrable);
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
  .use(withAccess);
