/**
 * Headers lookup implementation - core logic for fetching and persisting HTTP headers.
 *
 * This module contains the business logic extracted from the headers workflow.
 * It's used by both the standalone headersWorkflow and shared steps.
 */

import { getStatusCode } from "@readme/http-status-codes";
import { IMPORTANT_HEADERS } from "@/lib/constants/headers";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { fetchRemoteAsset } from "@/lib/fetch-remote-asset";
import { createLogger } from "@/lib/logger/server";
import { isExpectedTlsError } from "@/lib/tls-utils";
import { ttlForHeaders } from "@/lib/ttl";
import type { Header, HeadersResponse } from "@/lib/types";

// Note: Database imports are dynamic to avoid initialization issues in tests

const logger = createLogger({ source: "headers-lookup" });
const REQUEST_TIMEOUT_MS = 5000;

export interface HeadersFetchSuccess {
  success: true;
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

export interface HeadersFetchFailure {
  success: false;
  error: "dns_error" | "tls_error" | "fetch_error";
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

export type HeadersFetchResult = HeadersFetchSuccess | HeadersFetchFailure;

/**
 * Fetch HTTP headers from a domain.
 *
 * Returns a result with success/failure status. DNS and TLS errors
 * are treated as permanent failures (not retryable).
 */
export async function fetchHttpHeaders(
  domain: string,
): Promise<HeadersFetchResult> {
  const allowedHosts = [domain, `www.${domain}`];

  try {
    const final = await fetchRemoteAsset({
      url: `https://${domain}/`,
      allowHttp: true,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      allowedHosts,
      method: "HEAD",
      fallbackToGetOnHeadFailure: true,
      returnOnDisallowedRedirect: true,
    });

    const headers: Header[] = Object.entries(final.headers).map(
      ([name, value]) => ({ name, value }),
    );
    const normalized = normalizeHeaders(headers);

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
      headers: normalized,
      status: final.status,
      statusMessage,
    };
  } catch (err) {
    const isDnsError = isExpectedDnsError(err);
    const isTlsError = isExpectedTlsError(err);

    if (isDnsError) {
      return {
        success: false,
        error: "dns_error",
        headers: [],
        status: 0,
        statusMessage: undefined,
      };
    }

    if (isTlsError) {
      return {
        success: false,
        error: "tls_error",
        headers: [],
        status: 0,
        statusMessage: "Invalid SSL certificate",
      };
    }

    // Unknown error - return as fetch error (caller can decide to retry)
    logger.warn({ err, domain }, "failed to fetch headers");
    return {
      success: false,
      error: "fetch_error",
      headers: [],
      status: 0,
      statusMessage: undefined,
    };
  }
}

/**
 * Persist HTTP headers to database.
 *
 * Creates domain record if needed and schedules revalidation.
 */
export async function persistHttpHeaders(
  domain: string,
  headers: Header[],
  status: number,
): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForHeaders(now);

  // Dynamic imports for database operations
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceHeaders } = await import("@/lib/db/repos/headers");
  const { scheduleRevalidation } = await import("@/lib/schedule");

  // Ensure domain record exists (creates if needed)
  const domainRecord = await ensureDomainRecord(domain);

  await replaceHeaders({
    domainId: domainRecord.id,
    headers,
    status,
    fetchedAt: now,
    expiresAt,
  });

  // Schedule background revalidation
  await scheduleRevalidation(
    domain,
    "headers",
    expiresAt.getTime(),
    domainRecord.lastAccessedAt ?? null,
  );
}

/**
 * Fetch and persist HTTP headers in one operation.
 *
 * This is the main entry point for shared steps.
 * Returns the headers response, or null on permanent failure.
 */
export async function lookupAndPersistHeaders(
  domain: string,
): Promise<HeadersResponse | null> {
  const result = await fetchHttpHeaders(domain);

  // Only persist on success
  if (result.success) {
    try {
      await persistHttpHeaders(domain, result.headers, result.status);
    } catch (err) {
      logger.error({ err, domain }, "failed to persist headers");
      // Still return the data even if persistence failed
    }
  }

  return {
    headers: result.headers,
    status: result.status,
    statusMessage: result.statusMessage,
  };
}

/**
 * Normalize header names (trim + lowercase) then sort important headers first.
 */
export function normalizeHeaders(h: Header[]): Header[] {
  const normalized = h.map((hdr) => ({
    name: hdr.name.trim().toLowerCase(),
    value: hdr.value,
  }));
  return normalized.sort(
    (a, b) =>
      Number(IMPORTANT_HEADERS.has(b.name)) -
        Number(IMPORTANT_HEADERS.has(a.name)) || a.name.localeCompare(b.name),
  );
}
