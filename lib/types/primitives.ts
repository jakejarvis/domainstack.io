/**
 * Primitive types - Single source of truth for enums and basic types.
 *
 * This file defines const arrays that serve as the source of truth for:
 * - TypeScript union types (derived from const arrays)
 * - Drizzle pgEnums (imported and used directly)
 *
 * DO NOT use Zod for these simple enums - they are never validated at runtime.
 * Zod is only used for complex validation (external data, JSONB, API inputs).
 */

// =============================================================================
// User & Subscription
// =============================================================================

export const USER_TIERS = ["free", "pro"] as const;
export type UserTier = (typeof USER_TIERS)[number];

// =============================================================================
// Provider Types
// =============================================================================

export const PROVIDER_CATEGORIES = [
  "hosting",
  "email",
  "dns",
  "ca",
  "registrar",
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const PROVIDER_SOURCES = ["catalog", "discovered"] as const;
export type ProviderSource = (typeof PROVIDER_SOURCES)[number];

// =============================================================================
// Domain Verification
// =============================================================================

export const VERIFICATION_METHODS = [
  "dns_txt",
  "html_file",
  "meta_tag",
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_STATUSES = [
  "verified",
  "failing",
  "unverified",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

// =============================================================================
// DNS & Registration
// =============================================================================

export const DNS_RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "NS"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export const REGISTRATION_SOURCES = ["rdap", "whois"] as const;
export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

// =============================================================================
// SEO & Social
// =============================================================================

export const SOCIAL_PREVIEW_PROVIDERS = [
  "twitter",
  "facebook",
  "linkedin",
  "discord",
  "slack",
] as const;
export type SocialPreviewProvider = (typeof SOCIAL_PREVIEW_PROVIDERS)[number];

export const SOCIAL_PREVIEW_VARIANTS = ["compact", "large"] as const;
export type SocialPreviewVariant = (typeof SOCIAL_PREVIEW_VARIANTS)[number];

// =============================================================================
// Blob Storage
// =============================================================================

export const BLOB_KINDS = [
  "favicon",
  "screenshot",
  "opengraph",
  "provider-logo",
] as const;
export type BlobKind = (typeof BLOB_KINDS)[number];

// =============================================================================
// Domain Sections (for revalidation scheduling)
// =============================================================================

export const SECTIONS = [
  "dns",
  "headers",
  "hosting",
  "certificates",
  "seo",
  "registration",
] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * Get all sections as an array.
 * Replaces the Zod-based SectionEnum.options pattern.
 */
export function allSections(): Section[] {
  return [...SECTIONS];
}
