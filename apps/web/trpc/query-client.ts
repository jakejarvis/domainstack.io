import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

const NON_RETRYABLE_TRPC_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
  "PARSE_ERROR",
]);

function getTrpcErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data
  ) {
    const { code } = error.data;
    if (typeof code === "string") {
      return code;
    }
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}

/** Retry transient failures; skip 4xx tRPC codes and stop after two attempts. */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false;
  }
  const code = getTrpcErrorCode(error);
  if (code && NON_RETRYABLE_TRPC_CODES.has(code)) {
    return false;
  }
  return true;
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
        // Do not redact errors on the server; Next.js handles error redaction/digests
        shouldRedactErrors: () => false,
      },
    },
  });
};
