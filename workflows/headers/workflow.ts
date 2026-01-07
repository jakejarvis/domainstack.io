import { RetryableError } from "workflow";
import type { Header, HeadersResponse } from "@/lib/types";

export interface HeadersWorkflowInput {
  domain: string;
}

export interface HeadersWorkflowResult {
  success: boolean;
  data: HeadersResponse;
}

// Internal types for step-to-step transfer
interface FetchSuccess {
  success: true;
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

interface FetchFailure {
  success: false;
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

type FetchResult = FetchSuccess | FetchFailure;

/**
 * Durable headers workflow that breaks down HTTP header probing into
 * independently retryable steps:
 * 1. Fetch headers from domain
 * 2. Persist to database (creates domain record if needed)
 */
export async function headersWorkflow(
  input: HeadersWorkflowInput,
): Promise<HeadersWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch headers from domain
  const fetchResult = await fetchHeaders(domain);

  // Step 2: Persist to database (only if fetch succeeded)
  if (fetchResult.success) {
    await persistHeaders(domain, fetchResult.headers, fetchResult.status);
  }

  return {
    success: fetchResult.success,
    data: {
      headers: fetchResult.headers,
      status: fetchResult.status,
      statusMessage: fetchResult.statusMessage,
    },
  };
}

/**
 * Step: Fetch HTTP headers from the domain.
 */
export async function fetchHeaders(domain: string): Promise<FetchResult> {
  "use step";

  const { getStatusCode } = await import("@readme/http-status-codes");
  const { normalizeHeaders } = await import("@/lib/db/repos/headers");
  const { fetchRemoteAsset } = await import("@/lib/fetch-remote-asset");
  const { isExpectedDnsError } = await import("@/lib/dns-utils");
  const { isExpectedTlsError } = await import("@/lib/fetch");
  const { createLogger } = await import("@/lib/logger/server");
  const { IMPORTANT_HEADERS } = await import("@/lib/constants/headers");

  const logger = createLogger({ source: "headers-workflow" });
  const REQUEST_TIMEOUT_MS = 5000;
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
    const normalized = normalizeHeaders(headers, IMPORTANT_HEADERS);

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
      // Permanent failure - domain doesn't resolve, return graceful result
      return {
        success: false,
        headers: [],
        status: 0,
        statusMessage: undefined,
      };
    }

    if (isTlsError) {
      // Permanent failure - cert is invalid, return graceful result
      return {
        success: false,
        headers: [],
        status: 0,
        statusMessage: "Invalid SSL certificate",
      };
    }

    // Unknown/transient error - throw to trigger retry
    logger.warn({ err, domain }, "failed to fetch headers, will retry");
    throw new RetryableError("Headers fetch failed", { retryAfter: "5s" });
  }
}

/**
 * Step 3: Persist headers to Postgres.
 */
export async function persistHeaders(
  domain: string,
  headers: Header[],
  status: number,
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceHeaders } = await import("@/lib/db/repos/headers");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { ttlForHeaders } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "headers-workflow" });
  const now = new Date();
  const expiresAt = ttlForHeaders(now);

  try {
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
  } catch (err) {
    logger.error({ err, domain }, "failed to persist headers");
    // Don't throw - persistence failure shouldn't fail the workflow
  }
}
