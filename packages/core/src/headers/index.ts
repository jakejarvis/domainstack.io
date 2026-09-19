/**
 * Headers service - fetches and persists HTTP headers.
 *
 * Its internal helpers are also called by the monitoring workflow steps in
 * packages/workflows/src/steps.
 * Transient errors throw; `lookupSection` reports them as `fetch_failed`.
 * Permanent errors return { success: false, error }.
 */

import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import { replaceHeaders } from "@domainstack/db/queries/headers";
import type { HeadersResponse } from "@domainstack/types";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { shareInFlight } from "../lib/in-flight";
import { ttlForHeaders } from "../lib/ttl";
import { fetchHttpHeaders, HeadersFetchError } from "./fetch";
import type { HeadersError, HeadersFetchData } from "./types";

export { fetchHttpHeaders, HeadersFetchError } from "./fetch";
export { getHttpStatusMessage } from "./status-message";
export type { HeadersError, HeadersFetchData, HeadersFetchResult } from "./types";

// ============================================================================
// Types
// ============================================================================

export type HeadersResult =
  | { success: true; data: HeadersResponse }
  | { success: false; error: HeadersError };

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist HTTP headers for a domain.
 *
 * Concurrent calls for the same domain in this process share one fetch and one
 * write (e.g. a report batch where `getHeaders` and `getHosting` both need HTTP
 * headers). Every call that doesn't overlap an in-flight one fetches fresh data.
 *
 * @param domain - The domain to probe
 * @returns Headers result with data or error
 *
 * @throws Error on transient failures (network issues) - `lookupSection` reports these as `fetch_failed`
 */
export function fetchHeaders(domain: string): Promise<HeadersResult> {
  const normalizedDomain = domain.toLowerCase();
  return shareInFlight(`headers:${normalizedDomain}`, () =>
    fetchAndPersistHeaders(normalizedDomain),
  );
}

async function fetchAndPersistHeaders(domain: string): Promise<HeadersResult> {
  // 1. Fetch headers from domain (throws HeadersFetchError on transient failure)
  let fetchResult;
  try {
    fetchResult = await fetchHttpHeaders(domain);
  } catch (err) {
    if (err instanceof HeadersFetchError) {
      throw new RemoteDataUnavailableError("HTTP headers unavailable", { cause: err });
    }
    throw err;
  }

  if (!fetchResult.success) {
    return { success: false, error: fetchResult.error };
  }

  // 2. Persist to database
  await persistHeaders(domain, fetchResult.data);

  return {
    success: true,
    data: {
      headers: fetchResult.data.headers,
      status: fetchResult.data.status,
      statusMessage: fetchResult.data.statusMessage,
    },
  };
}

// ============================================================================
// Internal: Persist Headers
// ============================================================================

export async function persistHeaders(domain: string, fetchData: HeadersFetchData): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForHeaders(now);

  const domainRecord = await ensureDomainRecord(domain);

  await replaceHeaders({
    domainId: domainRecord.id,
    headers: fetchData.headers,
    status: fetchData.status,
    fetchedAt: now,
    expiresAt,
  });
}
