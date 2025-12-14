import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

export const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep previous data while refetching or hydrating
        placeholderData: (prev: unknown) => prev,
        // Avoid immediate invalidation of prefetched data once hydrated
        staleTime: 60_000, // 1 minute
        // Disable retries by default - most tRPC endpoints should fail fast
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
