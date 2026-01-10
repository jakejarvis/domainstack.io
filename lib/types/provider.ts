/**
 * Provider types - Plain TypeScript interfaces.
 */

import type { DnsRecord } from "./domain/dns";
import type { RegistrationContact } from "./domain/registration";

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
