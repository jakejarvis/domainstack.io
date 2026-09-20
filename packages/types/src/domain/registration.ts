/**
 * Registration types - Plain TypeScript interfaces.
 */

import type { PendingChangeObservation } from "../monitoring";
import type {
  RegistrationAvailability,
  RegistrationContactType,
  RegistrationSource,
  RegistrationUnavailableReason,
} from "../primitives";
import type { ProviderRef } from "./provider-ref";

/**
 * Registration contact information from WHOIS/RDAP.
 */
export interface RegistrationContact {
  type: RegistrationContactType;
  name?: string;
  /** vCard KIND (RDAP only). */
  kind?: "individual" | "org" | "group" | "location";
  organization?: string;
  /** vCard ORG levels below `organization` (RDAP only). */
  organizationUnits?: string[];
  title?: string;
  role?: string;
  email?: string | string[];
  phone?: string | string[];
  fax?: string | string[];
  poBox?: string;
  street?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  /** True when any of this contact's data was redacted or replaced by a placeholder. */
  redacted?: boolean;
  /** Fields the registry withheld or replaced with placeholder text (the field is then absent). */
  redactedFields?: RegistrationContactField[];
  /** True when `name`/`organization` names a privacy or proxy service, not the registrant. */
  privacyService?: boolean;
}

export type RegistrationContactField =
  | "name"
  | "organization"
  | "email"
  | "phone"
  | "fax"
  | "street"
  | "city"
  | "state"
  | "postalCode"
  | "poBox"
  | "country";

/**
 * Nameserver information.
 */
export interface RegistrationNameserver {
  host: string;
  ipv4?: string[];
  ipv6?: string[];
}

/**
 * Registration status with description.
 */
export interface RegistrationStatus {
  status: string;
  description?: string;
  raw?: string;
}

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
  status: RegistrationAvailability;
  /**
   * Reason why registration status is unknown.
   */
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
  /**
   * Raw RDAP/WHOIS response from the registry.
   * RDAP responses are JSON objects, WHOIS responses are plain text strings.
   * Display formatting (prettification) should happen on the client side.
   */
  rawResponse?: Record<string, unknown> | string;
}

/**
 * Registration snapshot data stored on `domain_snapshots.registration`.
 */
export interface RegistrationSnapshotData {
  registrarProviderId: string | null;
  nameservers: { host: string }[];
  transferLock: boolean | null;
  statuses: string[];
  /** Unconfirmed change awaiting a repeat observation (see confirmChange). */
  pending?: PendingChangeObservation | null;
  /** True once a confirmed "domain is no longer registered" alert has been handled for this snapshot. */
  unregistered?: boolean;
}
