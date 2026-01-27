/**
 * Registration constants and derived types.
 */

export const REGISTRATION_SOURCES = ["rdap", "whois"] as const;

export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];
