import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toRegistrableDomain } from "@/lib/domain-server";

// Matches beginning "http:" or "https:" followed by any number of slashes/colons
// Captures the authority (host + userinfo + port)
export const SCHEME_PREFIX_REGEX = /^https?[:/]+([^/]+)/i;

export type ProxyAction =
  | { type: "skip" }
  | { type: "match" }
  | { type: "redirect"; destination: string };

/**
 * Pure function to decide the proxy action based on the URL path.
 * Decoupled from NextRequest/NextResponse for easier testing.
 */
export function getProxyAction(path: string): ProxyAction {
  // Fast path: root path or empty
  if (path.length <= 1) {
    return { type: "skip" };
  }

  // 1. Get raw input (remove leading slash)
  const rawInput = path.slice(1);
  let decodedInput = rawInput;

  // 2. Decode if possible
  try {
    decodedInput = decodeURIComponent(rawInput);
  } catch {
    // ignore decoding failures
  }

  let candidate = decodedInput;

  // 3. Extract authority (host) candidate
  // If scheme present, extract authority from it.
  // Otherwise, treat the whole string as potential authority start.
  const schemeMatch = candidate.match(SCHEME_PREFIX_REGEX);
  let authority = schemeMatch ? schemeMatch[1] : candidate;

  // 4. Cleanup: Strip query, fragment, path (if not already stripped by regex)
  // Note: Regex above stops at first slash, so path is already gone if scheme matched.
  // If scheme didn't match, we manually strip path.
  if (!schemeMatch) {
    authority = authority.split("/")[0];
  }

  // Strip query and fragment (order doesn't matter as we take the first occurrence of either)
  authority = authority.split(/[?#]/)[0];

  authority = authority.trim();

  // 5. Strip User Info
  const atIndex = authority.lastIndexOf("@");
  if (atIndex !== -1) {
    authority = authority.slice(atIndex + 1);
  }

  // 6. Strip Port
  // IPv6 literals in brackets (e.g. [::1]) are not supported.
  if (authority.includes("[") || authority.includes("]")) {
    return { type: "skip" };
  }

  // Safe to split on colon as valid domains don't contain colons
  authority = authority.split(":")[0];

  candidate = authority.trim();

  if (!candidate) {
    return { type: "skip" };
  }

  // 7. Validate and Normalize
  // This will return null for invalid domains, including IPs if rdapper handles them as such.
  const registrable = toRegistrableDomain(candidate);
  if (!registrable) {
    return { type: "skip" };
  }

  // 8. Redirect if necessary
  // We compare the originally decoded input against the final canonical domain.
  // Any difference (path, query, scheme, case, whitespace, userinfo, port) triggers a redirect.
  if (decodedInput !== registrable) {
    return {
      type: "redirect",
      destination: `/${encodeURIComponent(registrable)}`,
    };
  }

  return { type: "match" };
}

export function handleProxyRequest(request: NextRequest) {
  const action = getProxyAction(request.nextUrl.pathname);

  const headers = new Headers();
  headers.set("x-middleware-decision", action.type);

  if (action.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = action.destination;
    url.search = "";
    url.hash = "";
    return NextResponse.redirect(url, {
      headers,
    });
  }

  return NextResponse.next({
    headers,
  });
}
