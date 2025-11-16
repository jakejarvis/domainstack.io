import {
  TTL_CERTIFICATES_EXPIRY_BUFFER,
  TTL_CERTIFICATES_MIN,
  TTL_CERTIFICATES_WINDOW,
  TTL_DNS_DEFAULT,
  TTL_DNS_MAX,
  TTL_FAVICON,
  TTL_HEADERS,
  TTL_HOSTING,
  TTL_REGISTRATION_EXPIRY_THRESHOLD,
  TTL_REGISTRATION_NEAR_EXPIRY,
  TTL_REGISTRATION_REGISTERED,
  TTL_SCREENSHOT,
  TTL_SEO,
} from "@/lib/constants";

// Helper functions
export function addSeconds(base: Date, seconds: number): Date {
  return new Date(base.getTime() + seconds * 1000);
}

export function clampFuture(min: Date, max: Date, now: Date): Date {
  const candidate = Math.max(min.getTime(), now.getTime() + 60_000);
  return new Date(candidate <= max.getTime() ? candidate : min.getTime());
}

// TTL calculation functions (return Date objects for Postgres timestamps)
export function ttlForRegistration(
  now: Date,
  expirationDate?: Date | null,
): Date {
  // Note: Only registered domains are stored in Postgres.
  // Unregistered domains are cached in Redis only (see REDIS_TTL_UNREGISTERED).
  if (expirationDate) {
    const msUntil = expirationDate.getTime() - now.getTime();
    if (msUntil <= TTL_REGISTRATION_EXPIRY_THRESHOLD * 1000) {
      // Revalidate more aggressively near expiry (within 7 days)
      return addSeconds(now, TTL_REGISTRATION_NEAR_EXPIRY);
    }
  }
  return addSeconds(now, TTL_REGISTRATION_REGISTERED);
}

export function ttlForDnsRecord(now: Date, ttlSeconds?: number | null): Date {
  const ttl =
    typeof ttlSeconds === "number" && ttlSeconds > 0
      ? Math.min(ttlSeconds, TTL_DNS_MAX)
      : TTL_DNS_DEFAULT;
  return addSeconds(now, ttl);
}

export function ttlForCertificates(now: Date, validTo: Date): Date {
  // Revalidate certificates within a 24h sliding window, but start checking
  // more aggressively 48h before expiry to catch upcoming expirations.
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
