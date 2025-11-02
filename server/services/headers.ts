import { eq } from "drizzle-orm";
import { recordDomainAccess } from "@/lib/access";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { replaceHeaders } from "@/lib/db/repos/headers";
import { httpHeaders } from "@/lib/db/schema";
import { ttlForHeaders } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import { fetchWithTimeout } from "@/lib/fetch";
import { scheduleSectionIfEarlier } from "@/lib/schedule";
import type { HttpHeader } from "@/lib/schemas";

export async function probeHeaders(domain: string): Promise<HttpHeader[]> {
  const url = `https://${domain}/`;
  console.debug(`[headers] start ${domain}`);

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Fast path: Check Postgres for cached HTTP headers
  const existingDomain = await findDomainByName(registrable);
  const existing = existingDomain
    ? await db
        .select({
          name: httpHeaders.name,
          value: httpHeaders.value,
          expiresAt: httpHeaders.expiresAt,
        })
        .from(httpHeaders)
        .where(eq(httpHeaders.domainId, existingDomain.id))
    : ([] as Array<{ name: string; value: string; expiresAt: Date | null }>);
  if (existing.length > 0) {
    const now = Date.now();
    const fresh = existing.every((h) => (h.expiresAt?.getTime?.() ?? 0) > now);
    if (fresh) {
      const normalized = normalize(
        existing.map((h) => ({ name: h.name, value: h.value })),
      );
      console.info(
        `[headers] cache hit ${registrable} count=${normalized.length}`,
      );
      return normalized;
    }
  }

  const REQUEST_TIMEOUT_MS = 5000;
  try {
    // Use GET to ensure provider-identifying headers are present on first load.
    const final = await fetchWithTimeout(
      url,
      { method: "GET", redirect: "follow" },
      { timeoutMs: REQUEST_TIMEOUT_MS },
    );

    const headers: HttpHeader[] = [];
    final.headers.forEach((value, name) => {
      headers.push({ name, value });
    });
    const normalized = normalize(headers);

    // Persist to Postgres only if domain exists (i.e., is registered)
    const now = new Date();
    const expiresAt = ttlForHeaders(now);
    const dueAtMs = expiresAt.getTime();

    if (existingDomain) {
      await replaceHeaders({
        domainId: existingDomain.id,
        headers: normalized,
        fetchedAt: now,
        expiresAt,
      });

      // Record access for decay calculation
      recordDomainAccess(registrable);

      try {
        await scheduleSectionIfEarlier(
          "headers",
          registrable,
          dueAtMs,
          now, // Use current access time, not stale DB timestamp
        );
      } catch (err) {
        console.warn(
          `[headers] schedule failed for ${registrable}`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
    console.info(
      `[headers] ok ${registrable} status=${final.status} count=${normalized.length}`,
    );
    return normalized;
  } catch (err) {
    // Classify error: DNS resolution failures are expected for domains without A/AAAA records
    const isDnsError = isExpectedDnsError(err);

    if (isDnsError) {
      console.debug(
        `[headers] no web hosting ${registrable} (no A/AAAA records)`,
      );
    } else {
      console.error(
        `[headers] error ${registrable}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    // Return empty on failure without caching to avoid long-lived negatives
    return [];
  }
}

function normalize(h: HttpHeader[]): HttpHeader[] {
  // Normalize header names (trim + lowercase) then sort important first
  const important = new Set([
    "strict-transport-security",
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "server",
    "x-powered-by",
    "cache-control",
    "permissions-policy",
  ]);
  const normalized = h.map((hdr) => ({
    name: hdr.name.trim().toLowerCase(),
    value: hdr.value,
  }));
  return normalized.sort(
    (a, b) =>
      Number(important.has(b.name)) - Number(important.has(a.name)) ||
      a.name.localeCompare(b.name),
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
