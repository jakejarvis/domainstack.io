import { cache } from "react";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "geoip" });

interface GeoIpResponse {
  geo: {
    city: string;
    region: string;
    country: string;
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
 * Uses iplocate.io API for IP geolocation and ASN/company data.
 * See: https://www.iplocate.io/docs/ip-intelligence-api/data-types
 *
 * Wrapped in React's cache() for per-request deduplication during SSR,
 * ensuring multiple services can query the same IP without triggering
 * duplicate API calls to the upstream provider.
 */
export const lookupGeoIp = cache(async function lookupGeoIp(
  ip: string,
): Promise<GeoIpResponse> {
  const apiKey = process.env.IPLOCATE_API_KEY;

  if (!apiKey) {
    logger.warn("IPLOCATE_API_KEY not configured, skipping IP lookup");
    return {
      owner: null,
      domain: null,
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
    };
  }

  try {
    const url = new URL(
      `https://www.iplocate.io/api/lookup/${encodeURIComponent(ip)}`,
    );
    url.searchParams.set("apikey", apiKey);

    const res = await fetchWithTimeoutAndRetry(url.toString());

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error(
        { ip, status: res.status, body: body.slice(0, 500) },
        "iplocate.io lookup failed with non-OK status",
      );
      throw new Error(`Upstream error looking up IP metadata: ${res.status}`);
    }

    // https://www.iplocate.io/docs/ip-intelligence-api/data-types
    const data = (await res.json()) as {
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
    };

    // Check for API error response
    if (data.error) {
      logger.error(
        { ip, error: data.error },
        "iplocate.io returned error message",
      );
      throw new Error(`iplocate.io error: ${data.error}`);
    }

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
  } catch (err) {
    logger.error({ err, ip }, "iplocate.io lookup failed");
    return {
      owner: null,
      domain: null,
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
    };
  }
});
