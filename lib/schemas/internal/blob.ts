import { z } from "zod";

export const BlobKindSchema = z.enum(["favicon", "screenshot", "opengraph"]);
export const BlobUrlResponseSchema = z.object({
  url: z.string().url().nullable(),
});

export type BlobKind = z.infer<typeof BlobKindSchema>;
export type BlobUrlResponse = z.infer<typeof BlobUrlResponseSchema>;
