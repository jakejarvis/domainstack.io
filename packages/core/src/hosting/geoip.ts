import { createLogger } from "@domainstack/logger";
import { getRedis } from "@domainstack/redis";
import type { GeoIpData } from "@domainstack/types";

const logger = createLogger({ source: "geoip" });

/** Raw iplocate.io API response - cached in Redis */
interface IplocateApiResponse {
  city?: string;
  subdivision?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  company?: { name?: string; domain?: string };
  asn?: { name?: string; domain?: string };
  error?: string;
}

/** Transform raw API response to application format */
function transformApiResponse(data: IplocateApiResponse): GeoIpData {
  return {
    geo: {
      city: data.city || "",
      region: data.subdivision || "",
      country: data.country || "",
      country_code: data.country_code || "",
      lat: typeof data.latitude === "number" ? data.latitude : null,
      lon: typeof data.longitude === "number" ? data.longitude : null,
    },
    owner: data.company?.name || data.asn?.name || null,
    domain: data.company?.domain || data.asn?.domain || null,
  };
}

/**
 * Lookup IP metadata including geolocation and ownership information.
 *
 * Caches raw API response in Redis - transformation happens on read.
 * This ensures cached data remains valid if transformation logic changes.
 */
export async function lookupGeoIp(ip: string): Promise<GeoIpData | null> {
  const redis = getRedis();
  const cacheKey = `geoip:${ip}`;

  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<IplocateApiResponse>(cacheKey);
      if (cached) {
        return transformApiResponse(cached);
      }
    } catch (err) {
      logger.warn({ err }, "redis cache read failed, falling back to API");
    }
  }

  // Fetch from iplocate.io API
  const apiKey = process.env.IPLOCATE_API_KEY;

  if (!apiKey) {
    logger.debug("IPLOCATE_API_KEY not configured, skipping IP lookup");
    return null;
  }

  try {
    const url = new URL(`https://www.iplocate.io/api/lookup/${encodeURIComponent(ip)}`);
    url.searchParams.set("apikey", apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: body.slice(0, 500) },
        "iplocate.io lookup failed with non-OK status",
      );
      return null;
    }

    const data = (await res.json()) as IplocateApiResponse;

    if (data.error) {
      logger.warn({ error: data.error }, "iplocate.io returned error message");
      return null;
    }

    // Cache raw response in Redis (fire-and-forget)
    if (redis) {
      redis.set(cacheKey, data, { ex: 43200 }).catch((err) => {
        logger.warn({ err }, "redis cache write failed");
      });
    }

    return transformApiResponse(data);
  } catch (err) {
    logger.warn({ err }, "iplocate.io lookup failed");
    return null;
  }
}
