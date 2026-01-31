/**
 * Headers fetch types.
 *
 * Shared types for HTTP header fetching operations.
 */

import type { Header } from "@domainstack/types";

/**
 * Typed error for headers operations.
 * - dns_error: Domain does not resolve
 * - tls_error: SSL certificate is invalid
 */
export type HeadersError = "dns_error" | "tls_error";

/**
 * Result of HTTP header fetching.
 */
export interface HeadersFetchData {
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

/**
 * Result of the headers fetch operation.
 * Discriminated union for type-safe error handling.
 */
export type HeadersFetchResult =
  | { success: true; data: HeadersFetchData }
  | { success: false; error: HeadersError };
