import { createLogger } from "@domainstack/logger";
import { del, put } from "@vercel/blob";
import type {
  BlobProvider,
  DeleteBlobResult,
  PutBlobOptions,
  PutBlobResult,
} from "../types";

const logger = createLogger({ source: "blob/vercel" });

/**
 * Vercel Blob storage provider
 */
export class VercelBlobProvider implements BlobProvider {
  async put(options: PutBlobOptions): Promise<PutBlobResult> {
    try {
      const blob = await put(options.pathname, options.body, {
        access: "public",
        contentType: options.contentType,
        cacheControlMaxAge: options.cacheControlMaxAge,
        allowOverwrite: true,
      });

      return {
        url: blob.url,
        pathname: options.pathname,
      };
    } catch (err) {
      logger.error(
        { err, pathname: options.pathname },
        "Failed to upload blob",
      );
      throw err;
    }
  }

  async delete(urls: string[]): Promise<DeleteBlobResult[]> {
    const results: DeleteBlobResult[] = [];
    if (!urls.length) return results;

    for (const url of urls) {
      try {
        await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
        results.push({ url, deleted: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        logger.error({ err, url }, "Failed to delete blob");
        results.push({ url, deleted: false, error: message });
      }
    }

    return results;
  }
}

/**
 * Default Vercel Blob provider instance
 */
export const vercelBlobProvider = new VercelBlobProvider();
