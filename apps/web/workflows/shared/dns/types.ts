/**
 * DNS shared step types.
 *
 * Re-exports types from @domainstack/server/dns.
 */

import type { DnsFetchData } from "@domainstack/server/dns";

// Re-export for backwards compatibility
export type { DnsFetchData } from "@domainstack/server/dns";

/**
 * Result of the DNS fetch step.
 * DNS always succeeds or throws RetryableError - there are no permanent failures.
 */
export type FetchDnsResult = { success: true; data: DnsFetchData };
