/**
 * Cache TTL constants for database and CDN caching.
 */

// Time constants (in seconds)
const ONE_MINUTE = 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_WEEK = ONE_DAY * 7;

// ===== Blob Storage Cache TTLs =====
// How long to cache uploaded assets (favicons, screenshots, social images)
export const TTL_FAVICON = ONE_WEEK; // 1 week
export const TTL_SCREENSHOT = 2 * ONE_WEEK; // 2 weeks
export const TTL_PROVIDER_ICON = ONE_WEEK; // 1 week (company logos change infrequently)

// ===== Avatar Proxy Cache TTLs =====
// CDN cache duration for proxied user avatars from OAuth providers
export const TTL_AVATAR_CDN = ONE_DAY; // 24 hours (s-maxage for CDN)
export const TTL_AVATAR_BROWSER = ONE_HOUR; // 1 hour (max-age for browser)
export const TTL_AVATAR_STALE = ONE_WEEK; // 1 week (stale-while-revalidate)

// ===== Database Cache Expiry TTLs =====
// When cached data in Postgres becomes stale and needs refresh.
// Used by lib/ttl.ts functions to calculate expiresAt timestamps.

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

// ===== Maximum Data Age (in milliseconds) =====
// Absolute maximum age before refusing to return stale data.
// If data is older than this, wait for fresh data instead of returning stale.
// These are typically 2-4x the staleness TTL to allow some grace period
// while still ensuring users don't see extremely outdated information.

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = ONE_MINUTE_MS * 60;
const ONE_DAY_MS = ONE_HOUR_MS * 24;

// Registration: Stale after 24h, max age 3 days
// WHOIS data rarely changes, but we don't want week-old data
export const MAX_AGE_REGISTRATION = 3 * ONE_DAY_MS;

// DNS: Stale after 1h, max age 6 hours
// DNS can change frequently, don't serve very old records
export const MAX_AGE_DNS = 6 * ONE_HOUR_MS;

// Certificates: Stale after 24h, max age 3 days
// Certificate data is important for security monitoring
export const MAX_AGE_CERTIFICATES = 3 * ONE_DAY_MS;

// Headers: Stale after 12h, max age 2 days
// HTTP headers can reveal important security/tech info
export const MAX_AGE_HEADERS = 2 * ONE_DAY_MS;

// Hosting: Stale after 24h, max age 3 days
// Provider detection derived from DNS/headers
export const MAX_AGE_HOSTING = 3 * ONE_DAY_MS;

// SEO: Stale after 24h, max age 3 days
// Meta tags and robots.txt change infrequently
export const MAX_AGE_SEO = 3 * ONE_DAY_MS;

// Favicon: No max age (cosmetic only, stale is fine)
// Favicons are purely cosmetic and rarely change
