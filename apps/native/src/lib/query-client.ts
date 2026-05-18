import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { analytics } from "./analytics";
import { handleCrossCuttingTrpcError, isNonRetryableTrpcError } from "./trpc-error-handler";

export function makeQueryClient() {
  return new QueryClient({
    // Catch UNAUTHORIZED (expired session) and rate-limit errors for EVERY
    // query/mutation centrally, even ones whose local handler doesn't. These
    // cache-level hooks fire exactly once per error (regardless of how many
    // component-level `onError`s also run), so they're also the single place
    // we report to PostHog — reporting inside `toastMutationError` would
    // double-count. Offline errors keep `error.name === "OfflineError"` for
    // easy filtering; they're included intentionally so nothing caught is
    // invisible to error tracking.
    queryCache: new QueryCache({
      onError: (error) => {
        handleCrossCuttingTrpcError(error);
        analytics.trackException(error, { handled: true, source: "query" });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        handleCrossCuttingTrpcError(error);
        analytics.trackException(error, { handled: true, source: "mutation" });
      },
    }),
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24,
        // A single cold-start network blip used to strand the screen on an
        // error state until manual retry. Retry transient failures twice, but
        // never retry 4xx-style tRPC errors (they won't recover and would
        // delay the UNAUTHORIZED → sign-out path).
        retry: (failureCount, error) => {
          if (isNonRetryableTrpcError(error)) return false;
          return failureCount < 2;
        },
        staleTime: 1000 * 60,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
