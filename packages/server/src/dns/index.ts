/**
 * DNS module.
 *
 * Pure DNS fetching logic shared by workflows and services.
 */

export { DnsProviderError, fetchDnsRecords } from "./fetch";
export type { DnsFetchData, DnsRecordWithExpiry } from "./types";
