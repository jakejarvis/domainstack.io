import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { createContext as createBaseContext } from "@domainstack/api";

/**
 * Web app wrapper that provides Next.js headers for RSC prefetching.
 *
 * In API routes: use request headers
 * In RSC prefetch: use next/headers
 *
 * React.cache() deduplicates the no-arg RSC path within a request.
 * API callers pass a Request object, which is unique per request.
 */
export const createContext = cache(async (opts?: { req?: Request }) => {
  const hdrs = opts?.req?.headers ?? (await headers());
  return createBaseContext({ req: opts?.req, headers: hdrs });
});
