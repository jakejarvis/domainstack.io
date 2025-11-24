import { z } from "zod";

export const DnsTypeSchema = z.enum(["A", "AAAA", "MX", "TXT", "NS"]);

export const DnsRecordSchema = z.object({
  type: DnsTypeSchema,
  name: z.string(),
  value: z.string(),
  ttl: z.number().optional(),
  priority: z.number().optional(),
  isCloudflare: z.boolean().optional(),
});

export const DnsRecordsSchema = z.array(DnsRecordSchema);

export const DnsRecordsResponseSchema = z.object({
  records: DnsRecordsSchema,
  resolver: z.string().nullable(),
});

export type DnsType = z.infer<typeof DnsTypeSchema>;
export type DnsRecord = z.infer<typeof DnsRecordSchema>;
export type DnsRecords = z.infer<typeof DnsRecordsSchema>;
export type DnsRecordsResponse = z.infer<typeof DnsRecordsResponseSchema>;
