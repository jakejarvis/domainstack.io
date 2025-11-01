export const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const USER_AGENT =
  process.env.EXTERNAL_USER_AGENT ||
  "domainstack.io/0.1 (+https://domainstack.io)";

export const REPOSITORY_SLUG = "jakejarvis/domainstack.io";

/**
 * RDAP Bootstrap Registry URL from IANA.
 * This JSON file maps TLDs to their authoritative RDAP servers.
 * @see https://datatracker.ietf.org/doc/html/rfc7484
 */
export const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";

/**
 * Cloudflare IP Ranges URL.
 * This JSON file contains the IP ranges for Cloudflare's network.
 * @see https://developers.cloudflare.com/api/resources/ips/methods/list/
 */
export const CLOUDFLARE_IPS_URL = "https://api.cloudflare.com/client/v4/ips";

// Time constants (in seconds)
const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;

// ===== Blob Storage Cache TTLs =====
// How long to cache uploaded assets (favicons, screenshots, social images)
export const TTL_FAVICON = ONE_WEEK; // 1 week
export const TTL_SCREENSHOT = 2 * ONE_WEEK; // 2 weeks
export const TTL_SOCIAL_PREVIEW = ONE_WEEK; // 1 week

// ===== Database Cache Expiry TTLs =====
// When cached data in Postgres becomes stale and needs refresh.
// Used by lib/db/ttl.ts functions to calculate expiresAt timestamps.

// Registration data
export const TTL_REGISTRATION_REGISTERED = ONE_DAY; // 24 hours
export const TTL_REGISTRATION_NEAR_EXPIRY = ONE_HOUR; // 1 hour (aggressive near expiry)
export const TTL_REGISTRATION_EXPIRY_THRESHOLD = ONE_WEEK; // 7 days (when to switch to aggressive)

// DNS records
export const TTL_DNS_DEFAULT = ONE_HOUR; // 1 hour (fallback when no TTL provided)
export const TTL_DNS_MAX = ONE_DAY; // 24 hours (cap for received TTLs)

// TLS certificates
export const TTL_CERTIFICATES_WINDOW = ONE_DAY; // 24 hours (normal refresh window)
export const TTL_CERTIFICATES_MIN = ONE_HOUR; // 1 hour (minimum check interval)
export const TTL_CERTIFICATES_EXPIRY_BUFFER = 2 * ONE_DAY; // 48 hours (start aggressive checking before expiry)

// HTTP headers, hosting, SEO
export const TTL_HEADERS = 12 * ONE_HOUR; // 12 hours
export const TTL_HOSTING = ONE_DAY; // 24 hours
export const TTL_SEO = ONE_DAY; // 24 hours

// ===== Redis Cache TTLs =====
// Lightweight registration status cache (stores only true/false, not full data).
// Unregistered domains are ONLY cached here, never in Postgres.
export const REDIS_TTL_REGISTERED = ONE_DAY; // 24 hours
export const REDIS_TTL_UNREGISTERED = ONE_HOUR; // 1 hour

// ===== Background Job Revalidation =====
// How often Inngest jobs attempt to refresh each section's data.
// These intervals determine "freshness" - shorter = more up-to-date but more load.
//
// Strategy:
// - Refresh at 100% of TTL (when cache expires): DNS, Hosting, SEO, Registration
// - Refresh at 50% of TTL (proactive refresh): Headers (6h for 12h TTL)
// - Refresh at 25% of TTL (aggressive): Certificates (6h for 24h window)
//
// Note: Actual refresh timing is bounded by these minimums via scheduleSectionIfEarlier().
// If a domain tries to schedule sooner, it gets pushed to the minimum interval.
export const REVALIDATE_MIN_DNS = TTL_DNS_DEFAULT; // 1h (refresh when expires)
export const REVALIDATE_MIN_HEADERS = TTL_HEADERS / 2; // 6h (proactive: refresh at 50% of 12h)
export const REVALIDATE_MIN_HOSTING = TTL_HOSTING; // 24h (refresh when expires)
export const REVALIDATE_MIN_CERTIFICATES = TTL_CERTIFICATES_WINDOW / 4; // 6h (aggressive: refresh at 25% of 24h)
export const REVALIDATE_MIN_SEO = TTL_SEO; // 24h (refresh when expires)
export const REVALIDATE_MIN_REGISTRATION = TTL_REGISTRATION_REGISTERED; // 24h (refresh when expires)

// ===== Background Job Configuration =====
// How often the cron job runs to drain the revalidation queue
export const DRAIN_CRON_MINUTES = 10;

export const PER_SECTION_BATCH = 50;
export const MAX_EVENTS_PER_RUN = 100;

// Lease duration matches cron interval to prevent overlapping executions
export const LEASE_SECS = DRAIN_CRON_MINUTES * 60;

export const BACKOFF_BASE_SECS = 5 * 60; // 5 minutes
export const BACKOFF_MAX_SECS = 6 * 60 * 60; // 6 hours

// File-like suffixes and extensions that should not be treated as TLDs/domains
// This is an allowlist of obvious web asset extensions and build artifacts
// that commonly appear in 404s (e.g., sourcemaps) and should be ignored.
export const BLACKLISTED_SUFFIXES: readonly string[] = [
  // https://fuckyougoogle.zip essentially.
  ".css.map",
  ".js.map",
  ".ts.map",
  ".mjs.map",
  ".cjs.map",

  // other
  ".arpa",
  ".onion",
];

// TLDs or domain suffixes that are not generally available to the public.
// This is a small, non-exhaustive list that can be expanded over time.
// Values should be lowercase and include the leading dot for suffix matching.
export const NONPUBLIC_TLDS: readonly string[] = [
  ".edu", // US accredited post-secondary institutions
  ".gov", // US government
  ".mil", // US military
  ".int", // International treaty-based orgs
  ".gov.uk", // UK government
  ".ac.uk", // UK academia
  ".aero",
  ".coop",
  ".museum",
  ".jobs",
  ".travel",
  ".post",
  ".tel",

  // TODO: add brands (.google, .amazon, etc.)
];
