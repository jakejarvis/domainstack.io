/**
 * Headers shared step types.
 *
 * Workflow fetch results include `fetch_error` for unreachable hosts so those
 * steps can complete without failing the parent tracking workflow.
 */

import type {
  HeadersError as ServerHeadersError,
  HeadersFetchData,
} from "@domainstack/server/headers";

export type { HeadersFetchData };

export type HeadersError = ServerHeadersError | "fetch_error";

export type FetchHeadersResult =
  | { success: true; data: HeadersFetchData }
  | { success: false; error: HeadersError };
