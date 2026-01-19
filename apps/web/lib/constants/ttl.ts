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

// ===== SWR Staleness Thresholds =====
// These define when cached data is considered "stale" and triggers background refresh.
// Used by withSwrCache() wrapper and warm-cache cron to determine refresh eligibility.
//
// Strategy:
// - 100% of TTL: DNS, Hosting, SEO, Registration (refresh when cache expires)
// - 50% of TTL: Headers (proactive refresh at 6h for 12h TTL)
// - 25% of TTL: Certificates (aggressive refresh at 6h for 24h window)
export const STALE_THRESHOLD_DNS = TTL_DNS_DEFAULT; // 1h
export const STALE_THRESHOLD_HEADERS = TTL_HEADERS / 2; // 6h
export const STALE_THRESHOLD_HOSTING = TTL_HOSTING; // 24h
export const STALE_THRESHOLD_CERTIFICATES = TTL_CERTIFICATES_WINDOW / 4; // 6h
export const STALE_THRESHOLD_SEO = TTL_SEO; // 24h
export const STALE_THRESHOLD_REGISTRATION = TTL_REGISTRATION_REGISTERED; // 24h
