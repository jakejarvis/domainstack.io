/**
 * Headers service - fetches and persists HTTP headers.
 *
 * Its internal helpers are also called by the monitoring workflow steps in
 * apps/web/workflows/shared.
 * Transient errors throw (for TanStack Query to retry).
 * Permanent errors return { success: false, error }.
 */

import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import { replaceHeaders } from "@domainstack/db/queries/headers";
import type { HeadersResponse } from "@domainstack/types";

import {
  fetchHttpHeaders,
  HeadersFetchError,
  type HeadersError,
  type HeadersFetchData,
} from "../headers";
import { ttlForHeaders } from "../ttl";
import { RemoteDataUnavailableError } from "./fetch-errors";
import { shareInFlight } from "./in-flight";

export { getHttpStatusMessage } from "../headers";

// ============================================================================
// Types
// ============================================================================

export type { HeadersError } from "../headers";

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
 * @throws Error on transient failures (network issues) - TanStack Query retries these
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
