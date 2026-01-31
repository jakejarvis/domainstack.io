import "server-only";

import { createHmac } from "node:crypto";
import { createLogger } from "@domainstack/logger";
import { vercelBlobProvider } from "./providers/vercel";
import type { BlobProvider, PutBlobResult } from "./types";

const logger = createLogger({ source: "blob/storage" });

const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_BACKOFF_BASE_MS = 100;
const UPLOAD_BACKOFF_MAX_MS = 2000;

/**
 * Deterministic, obfuscated hash for IDs and filenames.
 *
 * Notes:
 * - Uses HMAC-SHA256.
 * - Output is hex, safe for URLs/filenames.
 * - `length` is clamped to the valid SHA-256 hex range: 0..64.
 */
function deterministicHash(input: string, secret: string, length = 32): string {
  const safeLength = Number.isFinite(length)
    ? Math.max(0, Math.min(64, Math.trunc(length)))
    : 32;
  return createHmac("sha256", secret)
    .update(input)
    .digest("hex")
    .slice(0, safeLength);
}

function makeBlobPathname(
  kind: string,
  filename: string,
  extension = "bin",
  extraParts: Array<string | number>,
): string {
  const isDev = process.env.NODE_ENV === "development";
  const secret = process.env.BLOB_SIGNING_SECRET;
  if (!secret && !isDev) {
    throw new Error("BLOB_SIGNING_SECRET is not set");
  }

  const base = `${kind}:${extraParts.join(":")}`;
  const finalSecret = secret || "dev-hmac-secret";
  const digest = deterministicHash(base, finalSecret);

  return `${digest}/${filename}.${extension}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(
  attemptIndex: number,
  baseMs: number,
  maxMs: number,
): number {
  const base = Math.min(maxMs, baseMs * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * Math.min(base, maxMs) * 0.25);
  return Math.min(base + jitter, maxMs);
}

/**
 * Upload buffer with retry logic and exponential backoff
 */
async function uploadWithRetry(
  provider: BlobProvider,
  pathname: string,
  buffer: Buffer,
  contentType: string,
  cacheControlMaxAge?: number,
  maxAttempts = UPLOAD_MAX_ATTEMPTS,
): Promise<PutBlobResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await provider.put({
        pathname,
        body: buffer,
        contentType,
        cacheControlMaxAge,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      logger.warn({ err, pathname, attempt: attempt + 1, maxAttempts });

      if (attempt < maxAttempts - 1) {
        const delay = backoffDelayMs(
          attempt,
          UPLOAD_BACKOFF_BASE_MS,
          UPLOAD_BACKOFF_MAX_MS,
        );
        logger.warn({ err, pathname, retryDelay: delay });
        await sleep(delay);
      }
    }
  }

  throw new Error(`Upload failed after ${maxAttempts} attempts.`, {
    cause: lastError ?? undefined,
  });
}

export interface StoreBlobOptions {
  kind: string;
  buffer: Buffer;
  pathname?: string;
  contentType?: string;
  extension?: string;
  filename?: string;
  extraParts?: Array<string | number>;
  cacheControlMaxAge?: number;
  /** Optional custom provider (defaults to Vercel Blob) */
  provider?: BlobProvider;
}

export async function storeBlob(
  options: StoreBlobOptions,
): Promise<PutBlobResult> {
  const {
    kind,
    buffer,
    pathname: providedPathname,
    contentType: providedCt,
    extension: providedExt,
    filename: providedFilename,
    extraParts = [],
    cacheControlMaxAge,
    provider = vercelBlobProvider,
  } = options;

  let contentType = providedCt;
  let extension = providedExt;
  let filename = providedFilename;

  if (!contentType || !extension) {
    try {
      const { fileTypeFromBuffer } = await import("file-type");
      const ft = await fileTypeFromBuffer(buffer);
      if (!contentType) contentType = ft?.mime;
      if (!extension) extension = ft?.ext;
    } catch {
      // ignore detection errors; use fallbacks below
    }
  }

  contentType = contentType || "application/octet-stream";
  extension = extension || "bin";
  filename = filename || "file";

  const pathname =
    providedPathname || makeBlobPathname(kind, filename, extension, extraParts);

  return uploadWithRetry(
    provider,
    pathname,
    buffer,
    contentType,
    cacheControlMaxAge,
  );
}

export interface StoreImageOptions {
  kind: string;
  domain: string;
  buffer: Buffer;
  width?: number;
  height?: number;
  contentType?: string;
  extension?: string;
  cacheControlMaxAge?: number;
  /** Optional custom provider (defaults to Vercel Blob) */
  provider?: BlobProvider;
}

export async function storeImage(
  options: StoreImageOptions,
): Promise<PutBlobResult> {
  const {
    kind,
    domain,
    buffer,
    width: providedW,
    height: providedH,
    contentType,
    extension,
    cacheControlMaxAge,
    provider,
  } = options;

  let width = providedW;
  let height = providedH;

  if (!width || !height) {
    try {
      const { imageSize } = await import("image-size");
      const dim = imageSize(buffer);
      // biome-ignore lint/nursery/useDestructuring: might be null
      if (!width && typeof dim.width === "number") width = dim.width;
      // biome-ignore lint/nursery/useDestructuring: might be null
      if (!height && typeof dim.height === "number") height = dim.height;
    } catch {
      // ignore; width/height remain undefined
    }
  }

  const finalWidth = width ?? 0;
  const finalHeight = height ?? 0;

  return storeBlob({
    kind,
    buffer,
    filename: `${finalWidth}x${finalHeight}`,
    extraParts: [domain, kind, `${finalWidth}x${finalHeight}`],
    contentType: contentType || undefined,
    extension: extension || undefined,
    cacheControlMaxAge,
    provider,
  });
}
