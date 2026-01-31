import { createContext as createBaseContext } from "@domainstack/api";
import { headers } from "next/headers";

/**
 * Web app wrapper that provides Next.js headers for RSC prefetching.
 *
 * In API routes: use request headers
 * In RSC prefetch: use next/headers
 */
export async function createContext(opts?: { req?: Request }) {
  const hdrs = opts?.req?.headers ?? (await headers());
  return createBaseContext({ req: opts?.req, headers: hdrs });
}

export type { Context, ProcedureMeta, Session } from "@domainstack/api";
// Re-export everything else from the API package
export {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  TRPCError,
  t,
  withAuth,
  withDomainAccessUpdate,
  withLogging,
  withProTier,
  withRateLimit,
} from "@domainstack/api";
