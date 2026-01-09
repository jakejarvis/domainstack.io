/**
 * Registration types - Plain TypeScript interfaces.
 */

import type { REGISTRATION_SOURCES } from "@/lib/constants/registration";
import type { ProviderRef } from "../provider-ref";
import type { RegistrationContact } from "../rdap";

type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

/**
 * Nameserver information.
 */
interface RegistrationNameserver {
  host: string;
  ipv4?: string[];
  ipv6?: string[];
}

/**
 * Array of nameservers.
 */
export type RegistrationNameservers = RegistrationNameserver[];

/**
 * Registration status with description.
 */
interface RegistrationStatus {
  status: string;
  description?: string;
  raw?: string;
}

/**
 * Array of registration statuses.
 */
export type RegistrationStatuses = RegistrationStatus[];

/**
 * Full registration response from WHOIS/RDAP lookup.
 */
export interface RegistrationResponse {
  /**
   * Internal domain ID from database. Only present for registered domains
   * that have been persisted. Used for screenshot API requests.
   */
  domainId?: string;
  domain: string;
  tld: string;
  isRegistered: boolean;
  /**
   * Registration availability status.
   */
  status: "registered" | "unregistered" | "unknown";
  /**
   * Reason why registration status is unknown.
   */
  unavailableReason?: "unsupported_tld" | "timeout";
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
