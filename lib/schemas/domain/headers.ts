import { z } from "zod";

export const HeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const HeadersSchema = z.array(HeaderSchema);

export const HeadersResponseSchema = z.object({
  headers: HeadersSchema,
  status: z.number(),
  statusMessage: z.string().optional(),
  // True if we bypassed certificate validation due to an invalid/expired cert
  certificateBypassUsed: z.boolean().optional(),
});

export type Header = z.infer<typeof HeaderSchema>;
export type HeadersResponse = z.infer<typeof HeadersResponseSchema>;
