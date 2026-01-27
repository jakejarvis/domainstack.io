import type { GeoIpData } from "@domainstack/types";
import { cache } from "react";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";
import { getRedis } from "@/lib/redis";

const logger = createLogger({ source: "geoip" });

/** Redis cache key prefix for raw iplocate.io responses */
const CACHE_PREFIX = "geoip:";

/** Cache TTL in seconds (12 hours - IP geo data is fairly stable) */
const CACHE_TTL_SECONDS = 43200;

/**
 * Raw iplocate.io API response.
 * Cached in Redis to avoid repeated API calls.
 * @see https://www.iplocate.io/docs/ip-intelligence-api/data-types
 */
interface IplocateApiResponse {
  ip?: string;
  is_eu?: boolean;
  city?: string;
  subdivision?: string;
  country?: string;
  country_code?: string;
  continent?: string;
  latitude?: number;
  longitude?: number;
  postal_code?: string;
  calling_code?: string;
  time_zone?: string;
  currency_code?: string;
  is_anycast?: boolean;
  is_satellite?: boolean;
  asn?: {
    asn?: string;
    name?: string;
    domain?: string;
    route?: string;
    netname?: string;
    type?: string;
    country_code?: string;
    rir?: string;
  };
  company?: {
    name?: string;
    domain?: string;
    country_code?: string;
    type?: string;
  };
  hosting?: {
    provider?: string;
    domain?: string;
    network?: string;
  };
  privacy?: {
    is_abuser?: boolean;
    is_anonymous?: boolean;
    is_bogon?: boolean;
    is_hosting?: boolean;
    is_icloud_relay?: boolean;
    is_proxy?: boolean;
    is_tor?: boolean;
    is_vpn?: boolean;
  };
  abuse?: {
    address?: string;
    country_code?: string;
    email?: string;
    name?: string;
    network?: string;
    phone?: string;
  };
  error?: string; // Error message from API
}

/**
 * Fetch raw GeoIP data from iplocate.io API.
 * Returns the raw response for caching.
 */
async function fetchFromApi(ip: string): Promise<IplocateApiResponse> {
  const apiKey = process.env.IPLOCATE_API_KEY;

  if (!apiKey) {
    logger.warn("IPLOCATE_API_KEY not configured, skipping IP lookup");
    throw new Error("IPLOCATE_API_KEY not configured");
  }

  const url = new URL(
    `https://www.iplocate.io/api/lookup/${encodeURIComponent(ip)}`,
  );
  url.searchParams.set("apikey", apiKey);

  const res = await fetchWithTimeoutAndRetry(url.toString());

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error(
      { status: res.status, body: body.slice(0, 500) },
      "iplocate.io lookup failed with non-OK status",
    );
    throw new Error(`Upstream error looking up IP metadata: ${res.status}`);
  }

  const data = (await res.json()) as IplocateApiResponse;

  // Check for API error response
  if (data.error) {
    logger.error({ error: data.error }, "iplocate.io returned error message");
    throw new Error(`iplocate.io error: ${data.error}`);
  }

  return data;
}

/**
 * Get raw iplocate.io response, using Redis cache.
 * Caches the raw response for flexibility - transformation happens per-request.
 */
async function getOrFetchApiResponse(
  ip: string,
): Promise<IplocateApiResponse | null> {
  const redis = getRedis();
  const cacheKey = `${CACHE_PREFIX}${ip}`;

  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<IplocateApiResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      logger.warn({ err }, "redis cache read failed, falling back to API");
    }
  }

  // Cache miss or Redis unavailable - fetch from API
  try {
    const raw = await fetchFromApi(ip);

    // Store raw response in Redis (fire-and-forget)
    if (redis) {
      redis.set(cacheKey, raw, { ex: CACHE_TTL_SECONDS }).catch((err) => {
        logger.warn({ err }, "redis cache write failed");
      });
    }

    return raw;
  } catch (err) {
    logger.error({ err }, "iplocate.io lookup failed");
    return null;
  }
}

/**
 * Transform raw iplocate.io response to our application format.
 */
function transformApiResponse(data: IplocateApiResponse): GeoIpData {
  // Prefer company name over ASN name for more accurate ownership
  const owner = data.company?.name || data.asn?.name || null;
  const domain = data.company?.domain || data.asn?.domain || null;

  const geo = {
    city: data.city || "",
    region: data.subdivision || "",
    country: data.country || "",
    country_code: data.country_code || "",
    lat: typeof data.latitude === "number" ? data.latitude : null,
    lon: typeof data.longitude === "number" ? data.longitude : null,
  };

  return { geo, owner, domain };
}

const EMPTY_RESPONSE: GeoIpData = {
  geo: null,
  owner: null,
  domain: null,
};

/**
 * Lookup IP metadata including geolocation and ownership information.
 *
 * Caching strategy:
 * 1. Redis cache (cross-request) - stores raw iplocate.io response for 12 hours
 * 2. React cache (per-request) - deduplicates transformed response within a request
 *
 * Raw response is cached in Redis for flexibility - if transformation logic changes,
 * cached data remains valid. Transformation is cheap and happens per-request.
 */
export const lookupGeoIp = cache(async function lookupGeoIp(
  ip: string,
): Promise<GeoIpData> {
  const raw = await getOrFetchApiResponse(ip);

  if (!raw) {
    return EMPTY_RESPONSE;
  }

  return transformApiResponse(raw);
});
