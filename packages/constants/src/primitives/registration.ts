/**
 * Registration constants.
 */

export const REGISTRATION_SOURCES = ["rdap", "whois"] as const;

export const REGISTRATION_CONTACT_TYPES = [
  "registrant",
  "admin",
  "tech",
  "billing",
  "abuse",
  "registrar",
  "reseller",
  "unknown",
] as const;

export const REGISTRATION_AVAILABILITY = ["registered", "unregistered", "unknown"] as const;

export const REGISTRATION_UNAVAILABLE_REASONS = ["unsupported_tld", "timeout"] as const;
