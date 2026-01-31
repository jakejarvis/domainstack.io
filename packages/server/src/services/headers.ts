/**
 * Headers service - fetches and persists HTTP headers.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw (for TanStack Query to retry).
 * Permanent errors return { success: false, error }.
 */

import type { Header, HeadersResponse } from "@domainstack/types";
import { ttlForHeaders } from "../ttl";

// ============================================================================
// Types
// ============================================================================

export type HeadersError = "dns_error" | "tls_error";

export type HeadersResult =
  | { success: true; data: HeadersResponse }
  | { success: false; error: HeadersError };

interface HeadersFetchData {
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

// ============================================================================
// Main Service Function
// ============================================================================

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Fetch and persist HTTP headers for a domain.
 *
 * @param domain - The domain to probe
 * @returns Headers result with data or error
 *
 * @throws Error on transient failures (network issues) - TanStack Query retries these
 */
export async function fetchHeaders(domain: string): Promise<HeadersResult> {
  // 1. Fetch headers from domain
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
// Internal: Fetch HTTP Headers
// ============================================================================

type FetchResult =
  | { success: true; data: HeadersFetchData }
  | { success: false; error: HeadersError };

async function fetchHttpHeaders(domain: string): Promise<FetchResult> {
  const { getStatusCode } = await import("@readme/http-status-codes");
  const { isExpectedDnsError, safeFetch } = await import(
    "@domainstack/safe-fetch"
  );
  const { isExpectedTlsError } = await import("@domainstack/core/tls");

  const allowedHosts = [domain, `www.${domain}`];

  try {
    const final = await safeFetch({
      url: `https://${domain}/`,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      allowHttp: true,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      allowedHosts,
      method: "HEAD",
      fallbackToGetOnHeadFailure: true,
      returnOnDisallowedRedirect: true,
    });

    const headers: Header[] = Object.entries(final.headers).map(
      ([name, value]) => ({ name: name.trim().toLowerCase(), value }),
    );

    // Get status message
    let statusMessage: string | undefined;
    try {
      const statusInfo = getStatusCode(final.status);
      statusMessage = statusInfo.message;
    } catch {
      statusMessage = undefined;
    }

    return {
      success: true,
      data: {
        headers,
        status: final.status,
        statusMessage,
      },
    };
  } catch (err) {
    const isDnsError = isExpectedDnsError(err);
    const isTlsError = isExpectedTlsError(err);

    // Permanent failures - return error result
    if (isDnsError) {
      return { success: false, error: "dns_error" };
    }
    if (isTlsError) {
      return { success: false, error: "tls_error" };
    }

    // Transient failure - throw for TanStack Query to retry
    throw new Error("Headers fetch failed");
  }
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
