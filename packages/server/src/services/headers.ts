/**
 * Headers service - fetches and persists HTTP headers.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw (for TanStack Query to retry).
 * Permanent errors return { success: false, error }.
 */

import type { HeadersResponse } from "@domainstack/types";
import {
  fetchHttpHeaders,
  type HeadersError,
  type HeadersFetchData,
} from "../headers";
import { ttlForHeaders } from "../ttl";

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
 * @param domain - The domain to probe
 * @returns Headers result with data or error
 *
 * @throws Error on transient failures (network issues) - TanStack Query retries these
 */
export async function fetchHeaders(domain: string): Promise<HeadersResult> {
  // 1. Fetch headers from domain (throws HeadersFetchError on transient failure)
  const fetchResult = await fetchHttpHeaders(domain);

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

async function persistHeaders(
  domain: string,
  fetchData: HeadersFetchData,
): Promise<void> {
  const { ensureDomainRecord, replaceHeaders } = await import(
    "@domainstack/db/queries"
  );

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
