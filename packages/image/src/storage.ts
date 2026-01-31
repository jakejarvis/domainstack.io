import { storeBlob } from "@domainstack/blob";

export interface StoreImageOptions {
  /** Storage category (e.g., "favicon", "screenshot", "opengraph") */
  kind: string;
  /** Domain associated with the image (used for pathname hashing) */
  domain: string;
  /** Image buffer to store */
  buffer: Buffer;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Optional content type override */
  contentType?: string;
  /** Optional file extension override */
  extension?: string;
  /** Optional cache control max age in seconds */
  cacheControlMaxAge?: number;
}

/**
 * Store an image to blob storage with dimension-based naming.
 *
 * Creates a deterministic pathname using the domain, kind, and dimensions.
 * The filename follows the pattern `{width}x{height}.{ext}`.
 */
export async function storeImage(
  options: StoreImageOptions,
): Promise<{ url: string; pathname: string }> {
  const {
    kind,
    domain,
    buffer,
    width,
    height,
    contentType,
    extension,
    cacheControlMaxAge,
  } = options;

  return storeBlob({
    kind,
    buffer,
    filename: `${width}x${height}`,
    extraParts: [domain, kind, `${width}x${height}`],
    contentType,
    extension,
    cacheControlMaxAge,
  });
}
