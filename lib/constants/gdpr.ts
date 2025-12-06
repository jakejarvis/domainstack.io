/**
 * EU/EEA country codes that require GDPR consent.
 * Includes EU member states, EEA countries (Norway, Iceland, Liechtenstein),
 * and UK (still follows GDPR-like regulations).
 */
export const GDPR_COUNTRY_CODES = new Set([
  // EU Member States
  "AT", // Austria
  "BE", // Belgium
  "BG", // Bulgaria
  "HR", // Croatia
  "CY", // Cyprus
  "CZ", // Czechia
  "DK", // Denmark
  "EE", // Estonia
  "FI", // Finland
  "FR", // France
  "DE", // Germany
  "GR", // Greece
  "HU", // Hungary
  "IE", // Ireland
  "IT", // Italy
  "LV", // Latvia
  "LT", // Lithuania
  "LU", // Luxembourg
  "MT", // Malta
  "NL", // Netherlands
  "PL", // Poland
  "PT", // Portugal
  "RO", // Romania
  "SK", // Slovakia
  "SI", // Slovenia
  "ES", // Spain
  "SE", // Sweden
  // EEA (non-EU)
  "IS", // Iceland
  "LI", // Liechtenstein
  "NO", // Norway
  // UK (GDPR-equivalent via UK GDPR)
  "GB", // United Kingdom
]);

/**
 * Cookie name for consent requirement flag.
 * Set by proxy based on geolocation.
 */
export const CONSENT_REQUIRED_COOKIE = "consent-required";
