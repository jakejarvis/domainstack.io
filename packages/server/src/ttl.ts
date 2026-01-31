/**
 * TTL calculation functions for cache expiration.
 *
 * Returns Date objects for Postgres timestamp columns.
 */

import {
  TTL_CERTIFICATES_EXPIRY_BUFFER,
  TTL_CERTIFICATES_MIN,
  TTL_CERTIFICATES_WINDOW,
  TTL_DNS_DEFAULT,
  TTL_DNS_MAX,
  TTL_FAVICON,
  TTL_HEADERS,
  TTL_HOSTING,
  TTL_PROVIDER_ICON,
  TTL_REGISTRATION_EXPIRY_THRESHOLD,
  TTL_REGISTRATION_NEAR_EXPIRY,
  TTL_REGISTRATION_REGISTERED,
  TTL_SCREENSHOT,
  TTL_SEO,
} from "@domainstack/constants";

function addSeconds(base: Date, seconds: number): Date {
  return new Date(base.getTime() + seconds * 1000);
}

function clampFuture(min: Date, max: Date, now: Date): Date {
  const nowMs = now.getTime();
  const minMs = min.getTime();
  const maxMs = max.getTime();
  const candidate = Math.max(minMs, nowMs + 60_000);
  if (candidate <= maxMs) {
    return new Date(candidate);
  }
  if (maxMs >= minMs) {
    return new Date(maxMs);
  }
  return new Date(minMs);
}

/**
 * TTL for registration data.
 * Revalidates more aggressively near expiry (within 7 days).
 */
export function ttlForRegistration(
  now: Date,
  expirationDate?: Date | null,
): Date {
  if (expirationDate) {
    const msUntil = expirationDate.getTime() - now.getTime();
    if (msUntil <= TTL_REGISTRATION_EXPIRY_THRESHOLD * 1000) {
      return addSeconds(now, TTL_REGISTRATION_NEAR_EXPIRY);
    }
  }
  return addSeconds(now, TTL_REGISTRATION_REGISTERED);
}

/**
 * TTL for DNS records.
 * Uses the record's TTL if available, clamped to max.
 */
export function ttlForDnsRecord(now: Date, ttlSeconds?: number | null): Date {
  const ttl =
    typeof ttlSeconds === "number" && ttlSeconds > 0
      ? Math.min(ttlSeconds, TTL_DNS_MAX)
      : TTL_DNS_DEFAULT;
  return addSeconds(now, ttl);
}

/**
 * TTL for certificates.
 * Sliding window with aggressive checks near expiry.
 */
export function ttlForCertificates(now: Date, validTo: Date): Date {
  const window = addSeconds(now, TTL_CERTIFICATES_WINDOW);
  const revalidateBefore = new Date(
    validTo.getTime() - TTL_CERTIFICATES_EXPIRY_BUFFER * 1000,
  );
  return clampFuture(
    addSeconds(now, TTL_CERTIFICATES_MIN),
    new Date(Math.min(window.getTime(), revalidateBefore.getTime())),
    now,
  );
}

export function ttlForHeaders(now: Date): Date {
  return addSeconds(now, TTL_HEADERS);
}

export function ttlForHosting(now: Date): Date {
  return addSeconds(now, TTL_HOSTING);
}

export function ttlForSeo(now: Date): Date {
  return addSeconds(now, TTL_SEO);
}

export function ttlForFavicon(now: Date): Date {
  return addSeconds(now, TTL_FAVICON);
}

export function ttlForScreenshot(now: Date): Date {
  return addSeconds(now, TTL_SCREENSHOT);
}

export function ttlForProviderIcon(now: Date): Date {
  return addSeconds(now, TTL_PROVIDER_ICON);
}
