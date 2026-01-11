import "server-only";

/**
 * Resizes and crops an image buffer to WebP format using "cover" logic.
 * Maintains aspect ratio by scaling to cover the target area, then center-cropping.
 * Uses Photon (Rust/WASM) for high-performance image processing.
 */
export async function optimizeImageCover(
  buffer: Buffer,
  targetWidth: number,
  targetHeight: number,
): Promise<Buffer> {
  const photon = await import("@silvia-odwyer/photon-node");

  // Load image from buffer
  const img = photon.PhotonImage.new_from_byteslice(new Uint8Array(buffer));

  const srcWidth = img.get_width();
  const srcHeight = img.get_height();

  // Calculate scale factor to cover the target dimensions (like CSS object-fit: cover)
  const scaleX = targetWidth / srcWidth;
  const scaleY = targetHeight / srcHeight;
  const scale = Math.max(scaleX, scaleY);

  // Calculate new dimensions after scaling
  const scaledWidth = Math.round(srcWidth * scale);
  const scaledHeight = Math.round(srcHeight * scale);

  // Resize with Lanczos3 (high quality)
  const resized = photon.resize(
    img,
    scaledWidth,
    scaledHeight,
    photon.SamplingFilter.Lanczos3,
  );

  // Free original image memory
  img.free();

  // Calculate center crop coordinates
  const cropX = Math.floor((scaledWidth - targetWidth) / 2);
  const cropY = Math.floor((scaledHeight - targetHeight) / 2);

  // Crop to exact target dimensions from center
  const cropped = photon.crop(
    resized,
    cropX,
    cropY,
    cropX + targetWidth,
    cropY + targetHeight,
  );

  // Free resized image memory
  resized.free();

  // Convert to WebP
  const webpBytes = cropped.get_bytes_webp();

  // Free cropped image memory
  cropped.free();

  return Buffer.from(webpBytes);
}
