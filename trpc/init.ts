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
 * Domain-specific procedure with "last accessed at" tracking.
 * Use this for all domain data endpoints (dns, hosting, seo, etc).
 */
export const domainProcedure = publicProcedure.use(withDomainAccessUpdate);
