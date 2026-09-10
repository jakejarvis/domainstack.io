import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

import { isExpectedTrpcError } from "@/lib/trpc/errors";

/** Retry transient failures; skip deliberate tRPC errors and stop after two attempts. */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false;
  }
  return !isExpectedTrpcError(error);
}

export const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Avoid immediate invalidation of prefetched data once hydrated
        staleTime: 60_000, // 1 minute
        retry: shouldRetryQuery,
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        // Include pending queries so streaming works smoothly
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        // Hydrate the message only for errors the server raised on purpose.
        // Unexpected failures are redacted so their text stays off the wire.
        shouldRedactErrors: (error) => !isExpectedTrpcError(error),
      },
    },
  });
};
