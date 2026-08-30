import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@domainstack/auth/server";

/**
 * Per-request session lookup. Safe to call from multiple layouts or
 * server components in the same render — React.cache() deduplicates.
 */
export const getServerSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});
