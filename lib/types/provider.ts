/**
 * Provider types - Plain TypeScript interfaces.
 */

import type {
  DnsRecord,
  ProviderCategory,
  RegistrationContact,
} from "@/lib/types";

/**
 * Provider without detection rule.
 * The rule is a catalog concern, not needed in most app code.
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
