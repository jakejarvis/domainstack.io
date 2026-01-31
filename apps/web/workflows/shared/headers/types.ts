/**
 * Headers shared step types.
 *
 * Re-exports types from @domainstack/server/headers.
 */

import type {
  HeadersError,
  HeadersFetchData,
} from "@domainstack/server/headers";

// Re-export for backwards compatibility
export type {
  HeadersError,
  HeadersFetchData,
} from "@domainstack/server/headers";

/**
 * Result of the headers fetch step.
 * Discriminated union for type-safe error handling.
 */
export type FetchHeadersResult =
  | { success: true; data: HeadersFetchData }
  | { success: false; error: HeadersError };
