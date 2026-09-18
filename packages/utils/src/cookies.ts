/**
 * Parse raw `Set-Cookie` header values into a name → value map.
 *
 * Only the cookie pair matters for detection; attributes (Path, Secure,
 * SameSite, …) are discarded. Names are lowercased so lookups are
 * case-insensitive. A later cookie with the same name wins, matching browser
 * behavior for a single response.
 */
export function parseSetCookieHeaders(setCookie: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const raw of setCookie) {
    const pair = raw.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim().toLowerCase();
    const value = pair.slice(eq + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}
