/**
 * Important HTTP headers that should be highlighted in the UI.
 * These headers are security-related, caching-related, or provide
 * important server/hosting information.
 */
const IMPORTANT_HEADERS_LIST = [
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "server",
  "x-powered-by",
  "cache-control",
  "permissions-policy",
  "location",
];

/**
 * Set of important headers for efficient O(1) lookups.
 */
export const IMPORTANT_HEADERS: ReadonlySet<string> = new Set(
  IMPORTANT_HEADERS_LIST,
);
