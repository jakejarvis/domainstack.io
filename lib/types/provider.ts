/**
 * Provider types - Plain TypeScript interfaces.
 */

import type {
  PROVIDER_CATEGORIES,
  PROVIDER_SOURCES,
} from "@/lib/constants/providers";
import type { DnsRecord, RegistrationContact } from "@/lib/types";

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];
export type ProviderSource = (typeof PROVIDER_SOURCES)[number];

/**
 * Base provider shape for catalog/detection.
 */
export interface Provider {
  name: string;
  domain: string;
  category: ProviderCategory;
}

/**
 * Provider info with detailed verification data.
 * Used in provider tooltip components.
 */
export interface ProviderInfo {
  id: string | null;
  name: string | null;
  domain: string | null;
  records?: DnsRecord[];
  // Registrar-specific verification data (WHOIS/RDAP)
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: "rdap" | "whois" | null;
  transferLock?: boolean | null;
  registrantInfo?: {
    privacyEnabled: boolean | null;
    contacts: RegistrationContact[] | null;
  };
  // CA-specific verification data
  certificateExpiryDate?: Date | null;
}
