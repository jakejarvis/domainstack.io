import "server-only";

import sharp from "sharp";

/**
 * Resizes and crops an image buffer to WebP format using "cover" logic.
 * Maintains aspect ratio by scaling to cover the target area, then center-cropping.
 */
export async function optimizeImageCover(
  buffer: Buffer,
  targetWidth: number,
  targetHeight: number,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(targetWidth, targetHeight, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 80 })
    .toBuffer();
}
