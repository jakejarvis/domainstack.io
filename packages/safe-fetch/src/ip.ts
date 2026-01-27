import * as ipaddr from "ipaddr.js";

/**
 * Check if an IP address is in a private/reserved range.
 * Returns true for localhost, private networks, link-local, etc.
 */
export function isPrivateIp(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    return parsed.range() !== "unicast";
  } catch {
    // Invalid IP - treat as blocked for safety
    return true;
  }
}
