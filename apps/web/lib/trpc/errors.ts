/**
 * Shared classification of tRPC error codes.
 *
 * Both the TanStack Query client and the chat tool runner have to answer the
 * same question about a failed procedure call: did the caller cause this, or is
 * it a transient server-side failure worth retrying? They used to answer it
 * with separate lists that disagreed about the gateway and timeout codes, so
 * one retried them and the other reported them to the user as final.
 */

/**
 * Codes that mean "try again": the request itself was fine, the server or a
 * dependency was momentarily unavailable. Everything else in
 * {@link TRPC_ERROR_CODES} is treated as caller-caused.
 *
 * Listing the retryable side rather than the expected side means a code added
 * to tRPC later defaults to caller-caused, which fails safe: we surface it
 * instead of hammering an endpoint that will keep rejecting us.
 */
const RETRYABLE_TRPC_ERROR_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "TIMEOUT",
]);

/** Every code tRPC can put on an error, used to validate an unknown value. */
export const TRPC_ERROR_CODES = new Set([
  "PARSE_ERROR",
  "BAD_REQUEST",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "UNAUTHORIZED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UNPROCESSABLE_CONTENT",
  "PRECONDITION_REQUIRED",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

/**
 * Read the tRPC code off an unknown error.
 *
 * A `TRPCError` thrown on the server carries `code` directly; a
 * `TRPCClientError` carries the server's code under `data`. Both shapes are
 * checked, and the value is validated against {@link TRPC_ERROR_CODES} so an
 * unrelated `code` property, such as a Node `ECONNREFUSED`, is not mistaken
 * for one.
 */
export function getTrpcErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  if ("code" in err) {
    const code = asTrpcErrorCode(err.code);
    if (code) {
      return code;
    }
  }

  if ("data" in err && typeof err.data === "object" && err.data !== null && "code" in err.data) {
    return asTrpcErrorCode(err.data.code);
  }

  return undefined;
}

/**
 * True when the server raised this deliberately in response to the request.
 *
 * Such an error will not fix itself on retry, and its message describes
 * something the caller can act on, so it is safe to show and safe to hydrate.
 */
export function isExpectedTrpcError(err: unknown): boolean {
  const code = getTrpcErrorCode(err);
  return code !== undefined && !RETRYABLE_TRPC_ERROR_CODES.has(code);
}

function asTrpcErrorCode(code: unknown): string | undefined {
  return typeof code === "string" && TRPC_ERROR_CODES.has(code) ? code : undefined;
}
