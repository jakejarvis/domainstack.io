import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Codes tRPC raises deliberately, where the message describes a client-side
 * problem and is safe to show. Anything else (INTERNAL_SERVER_ERROR, a thrown
 * driver error) may carry server internals, so it is neither retried nor
 * serialized into the hydration payload.
 */
const EXPECTED_TRPC_ERROR_CODES = new Set([
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
  if (code && EXPECTED_TRPC_ERROR_CODES.has(code)) {
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
        // Hydrate the message only for errors the server raised on purpose.
        // Unexpected failures are redacted so their text stays off the wire.
        shouldRedactErrors: (error) => {
          const code = getTrpcErrorCode(error);
          return !code || !EXPECTED_TRPC_ERROR_CODES.has(code);
        },
      },
    },
  });
};
