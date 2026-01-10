/**
 * DNS constants and derived types.
 */

/**
 * Central list of DNS record types that we probe and display.
 */
export const DNS_RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "NS"] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];
