import { z } from "zod";

export const HttpHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const HttpHeadersSchema = z.array(HttpHeaderSchema);

export const HttpHeadersResponseSchema = z.object({
  headers: HttpHeadersSchema,
  status: z.number(),
  statusMessage: z.string().optional(),
});

export type HttpHeader = z.infer<typeof HttpHeaderSchema>;
export type HttpHeadersResponse = z.infer<typeof HttpHeadersResponseSchema>;
