import type { Header, HeadersResponse } from "@/lib/types";

export interface HeadersWorkflowInput {
  domain: string;
}

export interface HeadersWorkflowResult {
  success: boolean;
  cached: boolean;
  data: HeadersResponse;
}

// Internal types for step-to-step transfer
interface CacheHit {
  found: true;
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

interface CacheMiss {
  found: false;
  domainId: string | null;
  lastAccessedAt: string | null;
}

type CacheResult = CacheHit | CacheMiss;

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
 * 1. Check cache (Postgres)
 * 2. Fetch headers from domain
 * 3. Persist to database
 */
export async function headersWorkflow(
  input: HeadersWorkflowInput,
): Promise<HeadersWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Check Postgres cache
  const cacheResult = await checkCache(domain);

  if (cacheResult.found) {
    return {
      success: true,
      cached: true,
      data: {
        headers: cacheResult.headers,
        status: cacheResult.status,
        statusMessage: cacheResult.statusMessage,
      },
    };
  }

  // Step 2: Fetch headers from domain
  const fetchResult = await fetchHeaders(domain);

  // Step 3: Persist to database (only if domain exists and fetch succeeded)
  if (cacheResult.domainId && fetchResult.success) {
    await persistHeaders(
      cacheResult.domainId,
      fetchResult.headers,
      fetchResult.status,
      cacheResult.lastAccessedAt,
      domain,
    );
  }

  return {
    success: fetchResult.success,
    cached: false,
    data: {
      headers: fetchResult.headers,
      status: fetchResult.status,
      statusMessage: fetchResult.statusMessage,
    },
  };
}

/**
 * Step 1: Check Postgres cache for existing headers data.
 */
export async function checkCache(domain: string): Promise<CacheResult> {
  "use step";

  const { eq } = await import("drizzle-orm");
  const { getStatusCode } = await import("@readme/http-status-codes");
  const { db } = await import("@/lib/db/client");
  const { findDomainByName } = await import("@/lib/db/repos/domains");
  const { httpHeaders } = await import("@/lib/db/schema");
  const { IMPORTANT_HEADERS } = await import("@/lib/constants/headers");

  const now = Date.now();

  const existingDomain = await findDomainByName(domain);
  if (!existingDomain) {
    return { found: false, domainId: null, lastAccessedAt: null };
  }

  const existing = await db
    .select({
      headers: httpHeaders.headers,
      status: httpHeaders.status,
      expiresAt: httpHeaders.expiresAt,
    })
    .from(httpHeaders)
    .where(eq(httpHeaders.domainId, existingDomain.id))
    .limit(1);

  const row = existing[0];
  if (row && (row.expiresAt?.getTime?.() ?? 0) > now) {
    const normalized = normalizeHeaders(row.headers, IMPORTANT_HEADERS);

    // Get status message
    let statusMessage: string | undefined;
    try {
      const statusInfo = getStatusCode(row.status);
      statusMessage = statusInfo.message;
    } catch {
      statusMessage = undefined;
    }

    return {
      found: true,
      headers: normalized,
      status: row.status,
      statusMessage,
    };
  }

  return {
    found: false,
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

/**
 * Helper: Normalize header names (trim + lowercase) then sort important first.
 */
function normalizeHeaders(
  h: Header[],
  importantHeaders: ReadonlySet<string>,
): Header[] {
  const normalized = h.map((hdr) => ({
    name: hdr.name.trim().toLowerCase(),
    value: hdr.value,
  }));
  return normalized.sort(
    (a, b) =>
      Number(importantHeaders.has(b.name)) -
        Number(importantHeaders.has(a.name)) || a.name.localeCompare(b.name),
  );
}
