/**
 * Client-safe domain utilities.
 * Simplified version of @domainstack/core/domain/client.
 */

// Matches beginning "http:" or "https:" followed by any number of slashes/colons
const SCHEME_PREFIX_REGEX = /^https?[:/]+([^/]+)/i;

/**
 * Normalize arbitrary user input into a bare hostname string.
 * Accepts values like:
 *  - "example.com"
 *  - "www.example.com."
 *  - "https://example.com/path?x#y"
 *  - "http://user:pass@example.com:8080/"
 * Returns a lowercased hostname without scheme, path, auth, port, trailing dot, or www. prefix.
 * Returns empty string for invalid/unparseable input or IPv6 literals.
 */
export function normalizeDomainInput(input: string): string {
  let value = (input ?? "").trim();
  if (value === "") return "";

  // Reject IPv6 literals early
  if (value.includes("[") || value.includes("]")) {
    return "";
  }

  // Try to extract authority (host) from scheme-prefixed input
  const schemeMatch = value.match(SCHEME_PREFIX_REGEX);
  if (schemeMatch) {
    const [, authority] = schemeMatch;
    value = authority;
  } else if (/:\/\//.test(value)) {
    // Has scheme-like pattern but didn't match our regex
    try {
      const url = new URL(value);
      value = url.hostname;
    } catch {
      value = value.replace(/^\w+:\/\//, "");
    }
  } else {
    // No scheme detected: try URL parsing with implicit http://
    try {
      const url = new URL(`http://${value}`);
      value = url.hostname;
    } catch {
      // Fallback: treat as raw authority
    }
  }

  // Strip query and fragment
  // biome-ignore lint/nursery/useDestructuring: might be null
  value = value.split(/[?#]/)[0];

  // Strip User Info (credentials)
  const atIndex = value.lastIndexOf("@");
  if (atIndex !== -1) {
    value = value.slice(atIndex + 1);
  }

  // Strip port
  // biome-ignore lint/nursery/useDestructuring: might be null
  value = value.split(":")[0];

  // Remove any path components
  // biome-ignore lint/nursery/useDestructuring: might be null
  value = value.split("/")[0];

  // Strip trailing dot
  value = value.replace(/\.$/, "");

  // Trim whitespace
  value = value.trim();

  // Remove common leading www.
  value = value.replace(/^www\./i, "");

  return value.toLowerCase();
}

/**
 * Basic domain validity check (hostname-like).
 */
export function isValidDomain(value: string): boolean {
  const v = (value ?? "").trim();
  // Accept punycoded labels (xn--) by allowing digits and hyphens in TLD
  return /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+(?!-)[a-z0-9-]{2,63}(?<!-)$/.test(
    v.toLowerCase(),
  );
}

/**
 * Extract and validate domain from user input.
 * Returns the normalized domain or null if invalid.
 */
export function extractDomain(input: string): string | null {
  const normalized = normalizeDomainInput(input);
  if (!normalized || !isValidDomain(normalized)) {
    return null;
  }
  return normalized;
}
