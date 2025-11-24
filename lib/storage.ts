import "server-only";

import { putBlob } from "@/lib/blob";
import { deterministicHash } from "@/lib/hash";
import { createLogger } from "@/lib/logger/server";
import type { BlobKind } from "@/lib/schemas";

const logger = createLogger({ source: "storage" });

const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_BACKOFF_BASE_MS = 100;
const UPLOAD_BACKOFF_MAX_MS = 2000;

function makeBlobPathname(
  kind: BlobKind,
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
 * Upload buffer to Vercel Blob with retry logic and exponential backoff
 */
async function uploadWithRetry(
  pathname: string,
  buffer: Buffer,
  contentType: string,
  cacheControlMaxAge?: number,
  maxAttempts = UPLOAD_MAX_ATTEMPTS,
): Promise<{ url: string; pathname: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      logger.debug(`upload attempt ${attempt + 1}/${maxAttempts}`, {
        pathname,
      });

      const result = await putBlob({
        pathname,
        body: buffer,
        contentType,
        cacheControlMaxAge,
      });

      logger.info("upload ok", {
        pathname,
        attempts: attempt + 1,
      });

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      logger.warn(`upload attempt failed ${attempt + 1}/${maxAttempts}`, {
        pathname,
        attempts: attempt + 1,
      });

      // Don't sleep on last attempt
      if (attempt < maxAttempts - 1) {
        const delay = backoffDelayMs(
          attempt,
          UPLOAD_BACKOFF_BASE_MS,
          UPLOAD_BACKOFF_MAX_MS,
        );
        logger.debug(`retrying after ${delay}ms delay`, {
          pathname,
          durationMs: delay,
        });
        await sleep(delay);
      }
    }
  }

  throw new Error(`Upload failed after ${maxAttempts} attempts.`, {
    cause: lastError ?? undefined,
  });
}

export async function storeBlob(options: {
  kind: BlobKind;
  buffer: Buffer;
  pathname?: string;
  contentType?: string;
  extension?: string;
  filename?: string;
  extraParts?: Array<string | number>;
  cacheControlMaxAge?: number;
}): Promise<{ url: string; pathname: string }> {
  const {
    kind,
    buffer,
    pathname: providedPathname,
    contentType: providedCt,
    extension: providedExt,
    filename: providedFilename,
    extraParts = [],
    cacheControlMaxAge,
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
  const result = await uploadWithRetry(
    pathname,
    buffer,
    contentType,
    cacheControlMaxAge,
  );
  return result;
}

export async function storeImage(options: {
  kind: BlobKind;
  domain: string;
  buffer: Buffer;
  width?: number;
  height?: number;
  contentType?: string;
  extension?: string;
  cacheControlMaxAge?: number;
}): Promise<{ url: string; pathname: string }> {
  const {
    kind,
    domain,
    buffer,
    width: providedW,
    height: providedH,
    contentType,
    extension,
    cacheControlMaxAge,
  } = options;

  let width = providedW;
  let height = providedH;

  if (!width || !height) {
    try {
      const { imageSize } = await import("image-size");
      const dim = imageSize(buffer);
      if (!width && typeof dim.width === "number") width = dim.width;
      if (!height && typeof dim.height === "number") height = dim.height;
    } catch {
      // ignore; width/height remain undefined
    }
  }

  const finalWidth = width ?? 0;
  const finalHeight = height ?? 0;

  // Defer contentType/extension selection to storeBlob by passing filename and hash parts
  return await storeBlob({
    kind,
    buffer,
    filename: `${finalWidth}x${finalHeight}`,
    extraParts: [domain, kind, `${finalWidth}x${finalHeight}`],
    contentType: contentType || undefined,
    extension: extension || undefined,
    cacheControlMaxAge,
  });
}
