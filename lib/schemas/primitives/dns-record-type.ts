import { z } from "zod";

/**
 * DNS record type enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const DnsRecordTypeSchema = z.enum(["A", "AAAA", "MX", "TXT", "NS"]);
export type DnsRecordType = z.infer<typeof DnsRecordTypeSchema>;
