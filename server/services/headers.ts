import { getStatusCode } from "@readme/http-status-codes";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { cache } from "react";
import { IMPORTANT_HEADERS } from "@/lib/constants/headers";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { replaceHeaders } from "@/lib/db/repos/headers";
import { httpHeaders } from "@/lib/db/schema";
import { toRegistrableDomain } from "@/lib/domain-server";
import { fetchWithSelectiveRedirects } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";
import { scheduleRevalidation } from "@/lib/schedule";
import type { HttpHeader, HttpHeadersResponse } from "@/lib/schemas";
import { ttlForHeaders } from "@/lib/ttl";

const logger = createLogger({ source: "headers" });

/**
 * Probe HTTP headers for a domain with Postgres caching.
 *
 * Wrapped in React's cache() for per-request deduplication during SSR,
 * ensuring multiple components can query headers without triggering
 * multiple HTTP requests to the target domain.
 */
export const probeHeaders = cache(async function probeHeaders(
  domain: string,
): Promise<HttpHeadersResponse> {
  const url = `https://${domain}/`;
  logger.debug(`start ${domain}`, { domain });

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached HTTP headers
  const existingDomain = await findDomainByName(registrable);
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

    logger.info(`cache hit ${registrable}`, {
      domain: registrable,
      status: row.status,
      count: normalized.length,
      cached: true,
    });
    return { headers: normalized, status: row.status, statusMessage };
  }

  const REQUEST_TIMEOUT_MS = 5000;
  try {
    // Use GET to ensure provider-identifying headers are present on first load.
    // Only follow redirects between apex/www or http/https versions
    const final = await fetchWithSelectiveRedirects(
      url,
      { method: "GET" },
      { timeoutMs: REQUEST_TIMEOUT_MS },
    );

    const headers: HttpHeader[] = [];
    final.headers.forEach((value, name) => {
      headers.push({ name, value });
    });
    const normalized = normalize(headers);

    // Persist to Postgres only if domain exists (i.e., is registered)
    const expiresAt = ttlForHeaders(now);
    const dueAtMs = expiresAt.getTime();

    if (existingDomain) {
      await replaceHeaders({
        domainId: existingDomain.id,
        headers: normalized,
        status: final.status,
        fetchedAt: now,
        expiresAt,
      });

      after(() => {
        scheduleRevalidation(
          registrable,
          "headers",
          dueAtMs,
          existingDomain.lastAccessedAt ?? null,
        ).catch((err) => {
          logger.error("schedule failed", err, {
            domain: registrable,
          });
        });
      });
    }
    logger.info(`ok ${registrable}`, {
      domain: registrable,
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

    if (isDnsError) {
      logger.debug(`no web hosting ${registrable} (no A/AAAA records)`, {
        domain: registrable,
      });
    } else {
      logger.error(`error ${registrable}`, err, { domain: registrable });
    }

    // Return empty on failure without caching to avoid long-lived negatives
    return { headers: [], status: 0, statusMessage: undefined };
  }
});

function normalize(h: HttpHeader[]): HttpHeader[] {
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

/**
 * Check if an error is an expected DNS resolution failure.
 * These occur when a domain has no A/AAAA records (i.e., no web hosting).
 */
function isExpectedDnsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // Check for ENOTFOUND (getaddrinfo failure)
  const cause = (err as Error & { cause?: Error }).cause;
  if (cause && "code" in cause && cause.code === "ENOTFOUND") {
    return true;
  }

  // Check for other DNS-related error codes
  const errorWithCode = err as Error & { code?: string };
  if (errorWithCode.code === "ENOTFOUND") {
    return true;
  }

  // Check error message patterns
  const message = err.message.toLowerCase();
  return (
    message.includes("enotfound") ||
    message.includes("getaddrinfo") ||
    message.includes("dns lookup failed")
  );
}
