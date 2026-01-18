/**
 * Provider constants and derived types.
 */

export const PROVIDER_CATEGORIES = [
  "hosting",
  "email",
  "dns",
  "ca",
  "registrar",
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const PROVIDER_SOURCES = ["catalog", "discovered"] as const;
