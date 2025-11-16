/**
 * RDAP Bootstrap Registry URL from IANA.
 * This JSON file maps TLDs to their authoritative RDAP servers.
 * @see https://datatracker.ietf.org/doc/html/rfc7484
 */
export const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";

/**
 * RDAP Bootstrap cache TTL in seconds.
 * The bootstrap registry changes very infrequently, so we cache it for 1 week.
 */
export const RDAP_BOOTSTRAP_CACHE_TTL_SECONDS = 604800; // 1 week

/**
 * Cloudflare IP Ranges URL.
 * This JSON file contains the IP ranges for Cloudflare's network.
 * @see https://developers.cloudflare.com/api/resources/ips/methods/list/
 */
export const CLOUDFLARE_IPS_URL = "https://api.cloudflare.com/client/v4/ips";

/**
 * Cloudflare IP Ranges cache TTL in seconds.
 * The IP ranges change infrequently, so we cache it for 1 week.
 */
export const CLOUDFLARE_IPS_CACHE_TTL_SECONDS = 604800; // 1 week
