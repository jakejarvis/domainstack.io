/**
 * Hosting shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (HostingResponse) remain in lib/types/domain/hosting.ts.
 */

import type { ProviderRef } from "@/lib/types/domain/provider-ref";

/**
 * Internal data structure for GeoIP lookup result.
 */
export interface GeoIpData {
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
 * Internal data structure for provider detection result.
 */
export interface ProviderDetectionData {
  hostingProvider: ProviderRef;
  emailProvider: ProviderRef;
  dnsProvider: ProviderRef;
}
