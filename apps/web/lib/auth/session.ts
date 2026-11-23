import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import { auth } from "@domainstack/auth/server";

/**
 * Per-request session lookup. Safe to call from multiple layouts or
 * server components in the same render — React.cache() deduplicates.
 */
export const getServerSession = cache(async () => {
  // Better Auth checks session expiry against the current time, so the lookup
  // must wait for a real request instead of resolving into the App Shell.
  await connection();
  return auth.api.getSession({
    headers: await headers(),
  });
});
