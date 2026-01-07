/**
 * Registration contact types - Plain TypeScript interfaces.
 */

/**
 * Type of registration contact.
 */
export type RegistrationContactType =
  | "registrant"
  | "admin"
  | "tech"
  | "billing"
  | "abuse"
  | "registrar"
  | "reseller"
  | "unknown";

/**
 * Registration contact information from WHOIS/RDAP.
 */
export interface RegistrationContact {
  type: RegistrationContactType;
  name?: string;
  organization?: string;
  email?: string | string[];
  phone?: string | string[];
  fax?: string | string[];
  street?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

/**
 * Array of registration contacts.
 */
export type RegistrationContacts = RegistrationContact[];
