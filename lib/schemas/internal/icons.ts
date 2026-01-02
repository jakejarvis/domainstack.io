import { z } from "zod";

export const IconSourceSchema = z.object({
  url: z.string().url(),
  /** Source identifier for logging (e.g., "duckduckgo", "logo_dev") */
  name: z.string(),
  /** Optional custom headers for this source */
  headers: z.record(z.string(), z.string()).optional(),
  /** Allow HTTP (default: false) */
  allowHttp: z.boolean().optional(),
});

export type IconSource = z.infer<typeof IconSourceSchema>;

export const CachedIconRecordSchema = z.object({
  url: z.string().nullable(),
  notFound: z.boolean().optional(),
});

export type CachedIconRecord = z.infer<typeof CachedIconRecordSchema>;

export const FetchIconConfigSchema = z.object({
  /** Unique identifier for deduplication (e.g., domain, providerId) */
  identifier: z.string(),
  /** Kind of blob for storage (e.g., "favicon", "provider-logo") */
  blobKind: z.enum(["favicon", "provider-logo"]),
  /** Domain for blob storage path */
  blobDomain: z.string(),
  /** Sources to try in order (first success wins) */
  sources: z.array(IconSourceSchema),
  /** Icon size in pixels (default: 32) */
  size: z.number().optional(),
  /** Request timeout per source in ms (default: 1500) */
  timeoutMs: z.number().optional(),
  /** Max icon size in bytes (default: 1MB) */
  maxBytes: z.number().optional(),
});

export type FetchIconConfig = z.infer<typeof FetchIconConfigSchema> & {
  /** Function to check cache */
  getCachedRecord: () => Promise<CachedIconRecord | null>;
  /** Function to persist to database */
  persistRecord: (data: {
    url: string | null;
    pathname: string | null;
    size: number;
    source: string | null;
    notFound: boolean;
    upstreamStatus?: number | null;
    upstreamContentType?: string | null;
    fetchedAt: Date;
    expiresAt: Date;
  }) => Promise<void>;
  /** TTL calculator */
  ttlFn: (now: Date) => Date;
};
