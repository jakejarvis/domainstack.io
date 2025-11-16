import { z } from "zod";

export const StorageKindSchema = z.enum(["favicon", "screenshot", "opengraph"]);
export const StorageUrlSchema = z.object({ url: z.string().url().nullable() });

export type StorageKind = z.infer<typeof StorageKindSchema>;
export type StorageUrl = z.infer<typeof StorageUrlSchema>;
