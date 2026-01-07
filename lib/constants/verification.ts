/**
 * Domain verification system constants.
 * Centralized configuration for verification methods, grace periods, and format strings.
 */

import type { VerificationMethod } from "@/lib/types";

// ============================================================================
// Verification Methods & Statuses
// ============================================================================

export const VERIFICATION_METHODS = [
  "dns_txt",
  "html_file",
  "meta_tag",
] as const;

export const VERIFICATION_STATUSES = [
  "verified",
  "failing",
  "unverified",
] as const;

// ============================================================================
// Grace Period
// ============================================================================

/**
 * Number of days a domain can fail re-verification before being revoked.
 * During this grace period, users can fix their verification setup.
 */
export const VERIFICATION_GRACE_PERIOD_DAYS = 7;

// ============================================================================
// Verification Method Labels
// ============================================================================

/**
 * Human-readable labels for verification methods (used in UI badges and tooltips).
 */
export const VERIFICATION_METHOD_LABELS: Record<VerificationMethod, string> = {
  dns_txt: "TXT record",
  html_file: "file",
  meta_tag: "meta tag",
} as const;

/**
 * Longer descriptive labels for verification methods (used in tabs and headings).
 */
export const VERIFICATION_METHOD_DESCRIPTIONS: Record<
  VerificationMethod,
  string
> = {
  dns_txt: "DNS Record",
  html_file: "HTML File",
  meta_tag: "Meta Tag",
} as const;

// ============================================================================
// DNS Verification
// ============================================================================

/**
 * Prefix for DNS TXT record verification value.
 * Format: "domainstack-verify=TOKEN"
 */
export const DNS_VERIFICATION_PREFIX = "domainstack-verify=";

/**
 * Legacy subdomain prefix for DNS verification (backward compatibility).
 * Old format: _domainstack-verify.example.com TXT "domainstack-verify=TOKEN"
 * New format: example.com TXT "domainstack-verify=TOKEN"
 */
export const DNS_VERIFICATION_HOST_LEGACY = "_domainstack-verify";

/**
 * Recommended TTL for DNS verification records (in seconds).
 * 1 minute allows for reasonable propagation testing without excessive caching.
 */
export const DNS_VERIFICATION_TTL = 60;

/**
 * Human-readable label for the recommended TTL.
 */
export const DNS_VERIFICATION_TTL_LABEL = "1 minute";

// ============================================================================
// HTML File Verification
// ============================================================================

/**
 * Directory path for HTML verification files.
 * Supports per-token files for multiple users: /.well-known/domainstack-verify/TOKEN.html
 */
export const HTML_FILE_DIR = "/.well-known/domainstack-verify";

/**
 * Legacy HTML verification file path (backward compatibility).
 * Original single-file approach: /.well-known/domainstack-verify.html
 */
export const HTML_FILE_PATH_LEGACY = "/.well-known/domainstack-verify.html";

/**
 * Prefix for HTML file content.
 * Format: "domainstack-verify: TOKEN"
 */
export const HTML_FILE_CONTENT_PREFIX = "domainstack-verify: ";

// ============================================================================
// Meta Tag Verification
// ============================================================================

/**
 * Name attribute for verification meta tag.
 * Format: <meta name="domainstack-verify" content="TOKEN">
 */
export const META_TAG_NAME = "domainstack-verify";
