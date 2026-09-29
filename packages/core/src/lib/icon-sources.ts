import { optimizeImage } from "@domainstack/image";
import { safeFetch } from "@domainstack/safe-fetch";

import { isDefinitiveNotFoundError } from "./fetch-errors";

export interface IconSource {
  url: string;
  name: string;
  headers?: Record<string, string>;
  allowHttp?: boolean;
}

export type IconFetchResult =
  | {
      success: true;
      optimized: Buffer;
      contentType: string | null;
      status: number;
      sourceName: string;
    }
  | { success: false; allNotFound: boolean };

/**
 * Try each source in order and return the first response that decodes to an image,
 * resized to `size`×`size`. 404/400, empty bodies, and undecodable 200s mean "no icon
 * here"; `allNotFound` is false when any source failed in a way a retry could fix.
 */
export async function fetchFirstIcon(
  sources: IconSource[],
  options: { size: number; maxBytes: number; timeoutMs: number },
): Promise<IconFetchResult> {
  let allNotFound = true;

  for (const source of sources) {
    try {
      const headers = {
        Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
        ...source.headers,
      };

      const asset = await safeFetch({
        url: source.url,
        userAgent: process.env.EXTERNAL_USER_AGENT,
        headers,
        maxBytes: options.maxBytes,
        timeoutMs: options.timeoutMs,
        maxRedirects: 2,
        allowHttp: source.allowHttp ?? false,
      });

      if (!asset.ok) {
        const isDefinitiveNotFoundStatus = asset.status === 404 || asset.status === 400;
        if (!isDefinitiveNotFoundStatus) {
          allNotFound = false;
        }
        continue;
      }

      // A 200 with an empty body means "no icon here", same as a 404
      if (asset.buffer.length === 0) continue;

      let optimized: Buffer;
      try {
        optimized = await optimizeImage(asset.buffer, {
          width: options.size,
          height: options.size,
        });
      } catch {
        // A 200 that isn't an image (an SPA's HTML shell, say) means "no icon here", like a 404
        continue;
      }

      allNotFound = false;

      return {
        success: true,
        optimized,
        contentType: asset.contentType ?? null,
        status: asset.status,
        sourceName: source.name,
      };
    } catch (err) {
      if (!isDefinitiveNotFoundError(err)) {
        allNotFound = false;
      }
    }
  }

  return { success: false, allNotFound };
}
