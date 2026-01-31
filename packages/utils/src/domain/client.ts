/**
 * Client-safe domain utilities.
 *
 * These functions are safe to use in browser bundles - they don't depend on
 * rdapper or the Public Suffix List, only using basic string manipulation.
 *
 * For server-side PSL-based domain parsing, use the exports from
 * `@domainstack/utils/domain`.
 */

// Matches beginning "http:" or "https:" followed by any number of slashes/colons
// Captures the authority (host + userinfo + port)
// This handles malformed protocols like "http:/example.com" or "http:///example.com"
const SCHEME_PREFIX_REGEX = /^https?[:/]+([^/]+)/i;

/**
 * Normalize arbitrary user input into a bare hostname string.
 * Accepts values like:
 *  - "example.com"
 *  - "www.example.com."
 *  - "https://example.com/path?x#y"
 *  - "http://user:pass@example.com:8080/"
 *  - "http:/example.com" (malformed protocol)
 *  - "  EXAMPLE.COM  "
 * Returns a lowercased hostname without scheme, path, auth, port, trailing dot, or www. prefix.
 * Returns empty string for invalid/unparseable input or IPv6 literals.
 */
export function normalizeDomainInput(input: string): string {
  let value = (input ?? "").trim();
  if (value === "") return "";

  // Reject IPv6 literals early (e.g., "[::1]", "[::1]:8080")
  // These are not supported and would cause issues in URL parsing
  if (value.includes("[") || value.includes("]")) {
    return "";
  }

  // Try to extract authority (host) from scheme-prefixed input
  // This handles both valid and malformed protocols
  const schemeMatch = value.match(SCHEME_PREFIX_REGEX);
  if (schemeMatch) {
    // Extract authority from the scheme match
    const [, authority] = schemeMatch;
    value = authority;
  } else if (/:\/\//.test(value)) {
    // Has scheme-like pattern but didn't match our regex (e.g., "fake+scheme://...")
    // Try URL parsing first
    try {
      const url = new URL(value);
      value = url.hostname;
    } catch {
      // Fallback: strip scheme-like prefix manually
      value = value.replace(/^\w+:\/\//, "");
    }
  } else {
    // No scheme detected: try URL parsing with implicit http:// to get punycoded hostname
    try {
      const url = new URL(`http://${value}`);
      value = url.hostname;
    } catch {
      // Fallback: treat as raw authority and parse manually
    }
  }

  // Strip query and fragment (in case they weren't already removed)
  // biome-ignore lint/nursery/useDestructuring: this is simpler
  value = value.split(/[?#]/)[0];

  // Strip User Info (credentials)
  const atIndex = value.lastIndexOf("@");
  if (atIndex !== -1) {
    value = value.slice(atIndex + 1);
  }

  // Strip port
  // biome-ignore lint/nursery/useDestructuring: this is simpler
  value = value.split(":")[0];

  // Remove any path components that might remain
  // biome-ignore lint/nursery/useDestructuring: this is simpler
  value = value.split("/")[0];

  // Strip trailing dot
  value = value.replace(/\.$/, "");

  // Trim any remaining whitespace
  value = value.trim();

  // Remove common leading www.
  value = value.replace(/^www\./i, "");

  return value.toLowerCase();
}

/**
 * An even more basic domain validity check (hostname-like), not performing DNS or RDAP.
 */
export function isValidDomain(value: string): boolean {
  const v = (value ?? "").trim();
  // Accept punycoded labels (xn--) by allowing digits and hyphens in TLD as well,
  // while disallowing leading/trailing hyphens in any label.
  return /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+(?!-)[a-z0-9-]{2,63}(?<!-)$/.test(
    v.toLowerCase(),
  );
}

/**
 * Client-side utility to extract the TLD from a domain name.
 * This is a simple implementation that doesn't rely on rdapper (which is server-only).
 * For a full domain like "example.com", returns "com".
 * For a subdomain like "blog.example.com", returns "com".
 */
export function extractTldClient(domain: string): string | null {
  const input = (domain ?? "").trim().toLowerCase();

  // Ignore single-label hosts like "localhost" or invalid inputs
  if (!input.includes(".")) return null;

  // Split by dots and take everything after the first dot
  // For "example.com" -> ["example", "com"] -> "com"
  // For "blog.example.com" -> ["blog", "example", "com"] -> "example.com"
  const parts = input.split(".");
  if (parts.length < 2) return null;

  // Return everything after the first label joined with dots
  // This handles multi-part TLDs like "co.uk" correctly
  return parts.slice(1).join(".");
}
