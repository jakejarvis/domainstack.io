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
});

export type Header = z.infer<typeof HeaderSchema>;
export type HeadersResponse = z.infer<typeof HeadersResponseSchema>;
