import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

export const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Use a reasonable stale time (1 minute) to balance freshness with performance
        staleTime: 60 * 1000,
        // Disable retries by default - most tRPC endpoints should fail fast
        // (can be overridden per-query if needed)
        retry: false,
      },
      dehydrate: {
        // Include pending queries so streaming works smoothly
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        // Do not redact errors on the server; Next.js handles error redaction/digests
        shouldRedactErrors: () => false,
      },
    },
  });
};
