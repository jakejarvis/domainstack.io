/**
 * Hosting types - Plain TypeScript interfaces.
 */

import type { ProviderRef } from "./provider-ref";

/**
 * Geo location data for hosting.
 */
export interface HostingGeo {
  city: string;
  region: string;
  country: string;
  country_code: string;
  lat: number | null;
  lon: number | null;
}

/**
 * Response from hosting detection.
 */
export interface HostingResponse {
  hostingProvider: ProviderRef;
  emailProvider: ProviderRef;
  dnsProvider: ProviderRef;
  geo: HostingGeo | null;
}

/**
 * Internal data structure for GeoIP lookup result.
 */
export interface GeoIpData {
  geo: HostingGeo | null;
  owner: string | null;
  domain: string | null;
}
