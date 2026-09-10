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

  // Reduce the input to a bare authority. Scheme-prefixed input goes through
  // the regex so malformed protocols still work.
  const schemeMatch = value.match(SCHEME_PREFIX_REGEX);
  if (schemeMatch) {
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
  }

  // Strip query, fragment, and any remaining path components
  value = value.split(/[?#]/)[0];
  value = value.split("/")[0];

  // Re-parse the authority through URL on every path, so an IDN punycodes and
  // userinfo/port are dropped the same way whether or not a scheme was typed.
  try {
    value = new URL(`http://${value}`).hostname;
  } catch {
    // Fallback: strip user info and port by hand
    const atIndex = value.lastIndexOf("@");
    if (atIndex !== -1) {
      value = value.slice(atIndex + 1);
    }
    value = value.split(":")[0];
  }

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
 * Client-side utility to extract the TLD from a **registrable domain**
 * (eTLD+1), without rdapper or the Public Suffix List (both server-only).
 *
 * It simply drops the first label, which is the TLD only when the input really
 * is a registrable domain:
 * - "example.com" -> "com"
 * - "example.co.uk" -> "co.uk" (multi-part TLDs work)
 *
 * Given a subdomain it returns the parent domain, not a TLD
 * ("blog.example.com" -> "example.com"), so callers must normalize to the
 * registrable domain first. Returns null for single-label hosts.
 */
export function extractTldClient(domain: string): string | null {
  const input = (domain ?? "").trim().toLowerCase();

  // Ignore single-label hosts like "localhost" or invalid inputs
  if (!input.includes(".")) return null;

  const parts = input.split(".");
  if (parts.length < 2) return null;

  return parts.slice(1).join(".");
}
