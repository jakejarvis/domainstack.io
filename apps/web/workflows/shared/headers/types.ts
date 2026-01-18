/**
 * Headers shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (HeadersResponse) remain in lib/types/domain/headers.ts.
 */

import type { Header } from "@/lib/types/domain/headers";

/**
 * Typed error for headers operations.
 * - dns_error: Domain does not resolve
 * - tls_error: SSL certificate is invalid
 *
 * Note: fetch_error is thrown as RetryableError and never returned.
 */
export type HeadersError = "dns_error" | "tls_error";

/**
 * Internal data structure for step-to-step transfer.
 * Matches the successful fetch result.
 */
export interface HeadersFetchData {
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

/**
 * Result of the headers fetch step.
 * Discriminated union for type-safe error handling.
 */
export type FetchHeadersResult =
  | { success: true; data: HeadersFetchData }
  | { success: false; error: HeadersError };
