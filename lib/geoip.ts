import { cache } from "react";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "geoip" });

interface GeoIpResponse {
  geo: {
    city: string;
    region: string;
    country: string;
    country_emoji: string;
    country_code: string;
    lat: number | null;
    lon: number | null;
  };
  owner: string | null;
  domain: string | null;
}

/**
 * Lookup IP metadata including geolocation and ownership information.
 *
 * Uses ipdata.co API for IP geolocation and ASN/company data.
 * See: https://docs.ipdata.co/docs/all-response-fields
 *
 * Wrapped in React's cache() for per-request deduplication during SSR,
 * ensuring multiple services can query the same IP without triggering
 * duplicate API calls to the upstream provider.
 */
export const lookupGeoIp = cache(async function lookupGeoIp(
  ip: string,
): Promise<GeoIpResponse> {
  const apiKey = process.env.IPDATA_API_KEY;

  if (!apiKey) {
    logger.warn("IPDATA_API_KEY not configured, skipping IP lookup");
    return {
      owner: null,
      domain: null,
      geo: {
        city: "",
        region: "",
        country: "",
        country_emoji: "",
        country_code: "",
        lat: null,
        lon: null,
      },
    };
  }

  try {
    const url = new URL(`https://api.ipdata.co/${encodeURIComponent(ip)}`);
    url.searchParams.set("api-key", apiKey);

    const res = await fetchWithTimeoutAndRetry(url.toString());

    if (!res.ok) {
      logger.error({ status: res.status }, "ipdata.co lookup failed");
      throw new Error(`Upstream error looking up IP metadata: ${res.status}`);
    }

    // https://docs.ipdata.co/docs/all-response-fields
    const data = (await res.json()) as {
      ip?: string;
      is_eu?: boolean;
      city?: string;
      region?: string;
      region_code?: string;
      country_name?: string;
      country_code?: string;
      continent_name?: string;
      continent_code?: string;
      latitude?: number;
      longitude?: number;
      postal?: string;
      calling_code?: string;
      flag?: string;
      emoji_flag?: string;
      emoji_unicode?: string;
      asn?: {
        asn?: string;
        name?: string;
        domain?: string;
        route?: string;
        type?: string;
      };
      company?: {
        name?: string;
        domain?: string;
        network?: string;
        type?: string;
      };
    };

    // Prefer company name over ASN name for more accurate ownership
    const owner = data.company?.name || data.asn?.name || null;
    const domain = data.company?.domain || data.asn?.domain || null;

    const geo = {
      city: data.city || "",
      region: data.region || "",
      country: data.country_name || "",
      country_emoji: data.emoji_unicode || "",
      country_code: data.country_code || "",
      lat: typeof data.latitude === "number" ? data.latitude : null,
      lon: typeof data.longitude === "number" ? data.longitude : null,
    };

    return { geo, owner, domain };
  } catch (err) {
    logger.error(err, "ipdata.co lookup failed");
    return {
      owner: null,
      domain: null,
      geo: {
        city: "",
        region: "",
        country: "",
        country_emoji: "",
        country_code: "",
        lat: null,
        lon: null,
      },
    };
  }
});
