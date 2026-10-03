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

type RegistrationContactField =
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
   * Internal domain ID from the database. Present on every persisted result,
   * fresh or cached, registered or unregistered. Used for screenshot API requests.
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
  reseller?: string;
  statuses?: RegistrationStatus[];
  creationDate?: string;
  updatedDate?: string;
  expirationDate?: string;
  deletionDate?: string;
  transferLock?: boolean;
  nameservers?: RegistrationNameserver[];
  contacts?: RegistrationContact[];
  privacyEnabled?: boolean;
  whoisServer?: string;
  rdapServers?: string[];
  source: RegistrationSource | null;
  registrarProvider: ProviderRef;
  /**
   * Raw RDAP/WHOIS response from the registry. Set on the write path only
   * (normalize -> persist); cached reads don't return it (see `hasRawResponse`).
   * RDAP responses are JSON objects, WHOIS responses are plain text strings.
   * Display formatting (prettification) should happen on the client side.
   */
  rawResponse?: Record<string, unknown> | string;
  /** Whether a raw RDAP/WHOIS response is stored; fetch it with `domain.getRawRegistration`. */
  hasRawResponse?: boolean;
}

/**
 * Registration snapshot data stored on `domain_snapshots.registration`.
 */
export interface RegistrationSnapshotData {
  registrarProviderId: string | null;
  nameservers: { host: string }[];
  transferLock: boolean | null;
  statuses: string[];
  /**
   * "epp" once statuses come from rdapper ≥ 0.17, which maps RDAP and WHOIS
   * spellings to EPP codes. Older snapshots lack it, and their statuses are
   * re-baselined silently instead of compared (spelling isn't a change).
   */
  statusFormat?: "epp";
  /** Unconfirmed change awaiting a repeat observation (see confirmChange). */
  pending?: PendingChangeObservation | null;
  /** True once a confirmed "domain is no longer registered" alert has been handled for this snapshot. */
  unregistered?: boolean;
}
