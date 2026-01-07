/**
 * Registration types - Plain TypeScript interfaces.
 */

import type {
  ProviderRef,
  RegistrationContact,
  RegistrationSource,
} from "@/lib/types";

/**
 * Registration status with description.
 */
export interface RegistrationStatus {
  status: string;
  description?: string;
  raw?: string;
}

/**
 * Nameserver information.
 */
export interface RegistrationNameserver {
  host: string;
  ipv4?: string[];
  ipv6?: string[];
}

/**
 * Array of nameservers.
 */
export type RegistrationNameservers = RegistrationNameserver[];

/**
 * Array of registration statuses.
 */
export type RegistrationStatuses = RegistrationStatus[];

/**
 * Registration availability status.
 */
export type RegistrationStatusEnum = "registered" | "unregistered" | "unknown";

/**
 * Reason why registration status is unknown.
 */
export type RegistrationUnavailableReason = "unsupported_tld" | "timeout";

/**
 * Full registration response from WHOIS/RDAP lookup.
 */
export interface RegistrationResponse {
  domain: string;
  tld: string;
  isRegistered: boolean;
  status: RegistrationStatusEnum;
  unavailableReason?: RegistrationUnavailableReason;
  unicodeName?: string;
  punycodeName?: string;
  registry?: string;
  registrar?: {
    name?: string;
    ianaId?: string;
    url?: string;
    email?: string;
    phone?: string;
  };
  reseller?: string;
  statuses?: RegistrationStatus[];
  creationDate?: string;
  updatedDate?: string;
  expirationDate?: string;
  deletionDate?: string;
  transferLock?: boolean;
  dnssec?: {
    enabled: boolean;
    dsRecords?: {
      keyTag?: number;
      algorithm?: number;
      digestType?: number;
      digest?: string;
    }[];
  };
  nameservers?: RegistrationNameserver[];
  contacts?: RegistrationContact[];
  privacyEnabled?: boolean;
  whoisServer?: string;
  rdapServers?: string[];
  source: RegistrationSource | null;
  warnings?: string[];
  registrarProvider: ProviderRef;
}
