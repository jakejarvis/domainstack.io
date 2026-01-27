/**
 * Error codes for SafeFetchError.
 */
export type SafeFetchErrorCode =
  | "invalid_url"
  | "protocol_not_allowed"
  | "host_not_allowed"
  | "host_blocked"
  | "dns_error"
  | "private_ip"
  | "redirect_limit"
  | "invalid_response"
  | "size_exceeded"
  | "timeout"
  | "connection_error";

/**
 * Error thrown by safeFetch for infrastructure failures.
 *
 * HTTP errors (4xx, 5xx) are NOT thrown as SafeFetchError -
 * they're returned as successful responses for the caller to handle.
 */
export class SafeFetchError extends Error {
  readonly name = "SafeFetchError";

  constructor(
    readonly code: SafeFetchErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
