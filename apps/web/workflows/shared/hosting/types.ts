/**
 * Hosting shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (HostingResponse) remain in lib/types/domain/hosting.ts.
 */

import type { ProviderRef } from "@domainstack/types";

/**
 * Internal data structure for provider detection result.
 */
export interface ProviderDetectionData {
  hostingProvider: ProviderRef;
  emailProvider: ProviderRef;
  dnsProvider: ProviderRef;
}
