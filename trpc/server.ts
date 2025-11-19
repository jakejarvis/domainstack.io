import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/trpc/init";
import { makeQueryClient } from "@/trpc/query-client";

// Create a stable getter for the query client that will return the same client during
// the same request. This ensures consistent query client behavior across multiple tRPC
// calls within a single server request.
export const getQueryClient = cache(makeQueryClient);

// Strongly-typed tRPC proxy for server-side prefetching via queryOptions
export const trpc = createTRPCOptionsProxy({
  ctx: createContext,
  router: appRouter,
  queryClient: getQueryClient,
});
