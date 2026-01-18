import "server-only";

import { del, put } from "@vercel/blob";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "blob" });

/**
 * Upload a buffer to Vercel Blob storage
 */
export async function putBlob(options: {
  pathname: string;
  body: Buffer;
  contentType?: string;
  cacheControlMaxAge?: number;
}): Promise<{ url: string; pathname: string }> {
  try {
    const blob = await put(options.pathname, options.body, {
      access: "public",
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheControlMaxAge,
      allowOverwrite: true, // Pathnames are deterministic hashes, so updates overwrite existing blobs
    });

    return {
      url: blob.url,
      pathname: options.pathname,
    };
  } catch (err) {
    logger.error({ err, pathname: options.pathname });
    throw err;
  }
}

export type DeleteResult = Array<{
  url: string;
  deleted: boolean;
  error?: string;
}>;

/**
 * Delete one or more blobs by URL, tracking each URL's deletion status individually
 */
export async function deleteBlobs(urls: string[]): Promise<DeleteResult> {
  const results: DeleteResult = [];
  if (!urls.length) return results;

  // Process each URL individually to track per-URL success/failure
  for (const url of urls) {
    try {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      results.push({ url, deleted: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      logger.error({ err, url });

      results.push({ url, deleted: false, error: message });
    }
  }

  return results;
}
