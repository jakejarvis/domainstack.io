export async function lookupIpMeta(ip: string): Promise<{
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
}> {
  console.debug(`[ip] start lookup for ${ip}`);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (!res.ok) {
      console.error(`[ip] error looking up ${ip}`, res.statusText);
      throw new Error(`Upstream error looking up IP metadata: ${res.status}`);
    }

    // https://ipwhois.io/documentation
    const data = (await res.json()) as {
      ip?: string;
      success?: boolean;
      type?: "IPv4" | "IPv6";
      continent?: string;
      continent_code?: string;
      country?: string;
      country_code?: string;
      region?: string;
      region_code?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      is_eu?: boolean;
      postal?: string;
      calling_code?: string;
      capital?: string;
      borders?: string; // e.g., "CA,MX"
      flag?: {
        img?: string; // URL to SVG/PNG
        emoji?: string; // e.g., "🇺🇸"
        emoji_unicode?: string; // e.g., "U+1F1FA U+1F1F8"
      };
      connection: {
        asn?: number;
        org?: string;
        isp?: string;
        domain?: string;
      };
      timezone?: {
        id?: string; // IANA TZ, e.g., "America/New_York"
        abbr?: string; // e.g., "EDT"
        is_dst?: boolean;
        offset?: number; // seconds offset from UTC (can be negative)
        utc?: string; // e.g., "-04:00"
        current_time?: string; // ISO8601 with offset
      };
    };

    const org = data.connection?.org?.trim();
    const isp = data.connection?.isp?.trim();
    const owner = (org || isp || "").trim() || null;
    const domain = (data.connection?.domain || "").trim() || null;
    const geo = {
      city: data.city || "",
      region: data.region || "",
      country: data.country || "",
      country_code: data.country_code || "",
      lat: typeof data.latitude === "number" ? data.latitude : null,
      lon: typeof data.longitude === "number" ? data.longitude : null,
    };

    console.info(
      `[ip] ok ${ip} owner=${owner || "none"} domain=${domain || "none"}`,
    );

    return { geo, owner, domain };
  } catch (err) {
    console.warn(
      `[ip] error looking up ${ip}`,
      err instanceof Error ? err : new Error(String(err)),
    );
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
}
