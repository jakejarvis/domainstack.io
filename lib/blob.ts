import "server-only";

import { del, put } from "@vercel/blob";

/**
 * Upload a buffer to Vercel Blob storage
 */
export async function putBlob(options: {
  pathname: string;
  body: Buffer;
  contentType?: string;
  cacheControlMaxAge?: number;
}): Promise<{ url: string; pathname: string }> {
  const blob = await put(options.pathname, options.body, {
    access: "public",
    contentType: options.contentType,
    cacheControlMaxAge: options.cacheControlMaxAge,
    allowOverwrite: true, // TODO: temporary fix until KV/blob storage self-heals
  });

  return {
    url: blob.url,
    pathname: options.pathname,
  };
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
      const message = (err as Error)?.message || "unknown";
      console.error(
        `[blob] delete failed ${url}`,
        err instanceof Error ? err : new Error(String(err)),
      );
      results.push({ url, deleted: false, error: message });
    }
  }

  return results;
}
