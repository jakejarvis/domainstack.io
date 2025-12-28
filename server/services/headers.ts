import { getStatusCode } from "@readme/http-status-codes";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { cache } from "react";
import { IMPORTANT_HEADERS } from "@/lib/constants/headers";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { replaceHeaders } from "@/lib/db/repos/headers";
import { httpHeaders } from "@/lib/db/schema";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { isExpectedTlsError } from "@/lib/fetch";
import { fetchRemoteAsset } from "@/lib/fetch-remote-asset";
import { createLogger } from "@/lib/logger/server";
import { scheduleRevalidation } from "@/lib/schedule";
import type { Header, HeadersResponse } from "@/lib/schemas";
import { ttlForHeaders } from "@/lib/ttl";

const logger = createLogger({ source: "headers" });

export type ServiceOptions = {
  skipScheduling?: boolean;
};

/**
 * Probe HTTP headers for a domain with Postgres caching.
 *
 * Wrapped in React's cache() for per-request deduplication during SSR,
 * ensuring multiple components can query headers without triggering
 * multiple HTTP requests to the target domain.
 */
export const getHeaders = cache(async function getHeaders(
  domain: string,
  options: ServiceOptions = {},
): Promise<HeadersResponse> {
  // Input domain is already normalized to registrable domain by router schema
  const url = `https://${domain}/`;
  logger.debug("start", { domain });

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached HTTP headers
  const existingDomain = await findDomainByName(domain);
  const existing = existingDomain
    ? await db
        .select({
          headers: httpHeaders.headers,
          status: httpHeaders.status,
          expiresAt: httpHeaders.expiresAt,
        })
        .from(httpHeaders)
        .where(eq(httpHeaders.domainId, existingDomain.id))
        .limit(1)
    : [];

  if (existing[0] && (existing[0].expiresAt?.getTime?.() ?? 0) > nowMs) {
    const row = existing[0];
    const normalized = normalize(row.headers);
    // Get status message
    let statusMessage: string | undefined;
    try {
      const statusInfo = getStatusCode(row.status);
      statusMessage = statusInfo.message;
    } catch {
      statusMessage = undefined;
    }

    logger.debug("cache hit", {
      domain,
      status: row.status,
      count: normalized.length,
      cached: true,
    });
    return { headers: normalized, status: row.status, statusMessage };
  }

  const REQUEST_TIMEOUT_MS = 5000;
  const allowedHosts = [domain, `www.${domain}`];
  try {
    const final = await fetchRemoteAsset({
      url,
      allowHttp: true, // allow http fallback but still enforce IP allow list
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      allowedHosts,
      method: "HEAD", // only need headers, not body
      fallbackToGetOnHeadFailure: true, // retry with GET if HEAD is not allowed
    });

    const headers: Header[] = Object.entries(final.headers).map(
      ([name, value]) => ({ name, value }),
    );
    const normalized = normalize(headers);

    // Persist to Postgres only if domain exists (i.e., is registered)
    const expiresAt = ttlForHeaders(now);

    if (existingDomain) {
      await replaceHeaders({
        domainId: existingDomain.id,
        headers: normalized,
        status: final.status,
        fetchedAt: now,
        expiresAt,
      });

      if (!options.skipScheduling) {
        after(() =>
          scheduleRevalidation(
            domain,
            "headers",
            expiresAt.getTime(),
            existingDomain.lastAccessedAt ?? null,
          ),
        );
      }
    }

    logger.info("done", {
      domain,
      status: final.status,
      count: normalized.length,
    });

    // Get status message
    let statusMessage: string | undefined;
    try {
      const statusInfo = getStatusCode(final.status);
      statusMessage = statusInfo.message;
    } catch {
      statusMessage = undefined;
    }

    return { headers: normalized, status: final.status, statusMessage };
  } catch (err) {
    // Classify error: DNS resolution failures are expected for domains without A/AAAA records
    const isDnsError = isExpectedDnsError(err);
    const isTlsError = isExpectedTlsError(err);

    if (isDnsError) {
      logger.debug("no web hosting (no A/AAAA records)", {
        domain,
      });
    } else if (isTlsError) {
      logger.debug("probe failed (TLS error)", {
        domain,
        code: (err as unknown as { cause?: { code?: string } })?.cause?.code,
      });
      return {
        headers: [],
        status: 0,
        statusMessage: "Invalid SSL certificate",
      };
    } else {
      logger.error("probe failed", err, { domain });
    }

    // Return empty on failure without caching to avoid long-lived negatives
    return { headers: [], status: 0, statusMessage: undefined };
  }
});

function normalize(h: Header[]): Header[] {
  // Normalize header names (trim + lowercase) then sort important first
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

// NOTE: isExpectedDnsError logic moved to @/lib/dns-utils.ts
