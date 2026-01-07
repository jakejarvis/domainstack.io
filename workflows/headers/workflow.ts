import type { Header, HeadersResponse } from "@/lib/types";

export interface HeadersWorkflowInput {
  domain: string;
}

export interface HeadersWorkflowResult {
  success: boolean;
  data: HeadersResponse;
}

// Internal types for step-to-step transfer
interface DomainInfo {
  domainId: string | null;
  lastAccessedAt: string | null;
}

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
 * 1. Get domain info (for persistence)
 * 2. Fetch headers from domain
 * 3. Persist to database
 */
export async function headersWorkflow(
  input: HeadersWorkflowInput,
): Promise<HeadersWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Get domain info
  const domainInfo = await getDomainInfo(domain);

  // Step 2: Fetch headers from domain
  const fetchResult = await fetchHeaders(domain);

  // Step 3: Persist to database (only if domain exists and fetch succeeded)
  if (domainInfo.domainId && fetchResult.success) {
    await persistHeaders(
      domainInfo.domainId,
      fetchResult.headers,
      fetchResult.status,
      domainInfo.lastAccessedAt,
      domain,
    );
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
 * Step 1: Get domain info for persistence.
 */
export async function getDomainInfo(domain: string): Promise<DomainInfo> {
  "use step";

  const { findDomainByName } = await import("@/lib/db/repos/domains");

  const existingDomain = await findDomainByName(domain);
  if (!existingDomain) {
    return { domainId: null, lastAccessedAt: null };
  }

  return {
    domainId: existingDomain.id,
    lastAccessedAt: existingDomain.lastAccessedAt?.toISOString() ?? null,
  };
}

/**
 * Step 2: Fetch HTTP headers from the domain.
 */
export async function fetchHeaders(domain: string): Promise<FetchResult> {
  "use step";

  const { getStatusCode } = await import("@readme/http-status-codes");
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
      // Fail silently for DNS errors
    } else if (isTlsError) {
      return {
        success: false,
        headers: [],
        status: 0,
        statusMessage: "Invalid SSL certificate",
      };
    } else {
      logger.error({ err, domain }, "failed to fetch headers");
    }

    return {
      success: false,
      headers: [],
      status: 0,
      statusMessage: undefined,
    };
  }
}

/**
 * Step 3: Persist headers to Postgres.
 */
export async function persistHeaders(
  domainId: string,
  headers: Header[],
  status: number,
  lastAccessedAtIso: string | null,
  domain: string,
): Promise<void> {
  "use step";

  const { replaceHeaders } = await import("@/lib/db/repos/headers");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { ttlForHeaders } = await import("@/lib/ttl");

  const now = new Date();
  const expiresAt = ttlForHeaders(now);

  await replaceHeaders({
    domainId,
    headers,
    status,
    fetchedAt: now,
    expiresAt,
  });

  // Schedule background revalidation
  const lastAccessedAt = lastAccessedAtIso ? new Date(lastAccessedAtIso) : null;
  void scheduleRevalidation(
    domain,
    "headers",
    expiresAt.getTime(),
    lastAccessedAt,
  );
}
