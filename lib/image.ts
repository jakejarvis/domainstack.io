import "server-only";

/**
 * Resizes and optimizes an image buffer to WebP format.
 * Uses Photon (Rust/WASM) for high-performance image processing.
 */
export async function optimizeImageCover(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const photon = await import("@silvia-odwyer/photon-node");

  // Load image from buffer
  const img = photon.PhotonImage.new_from_byteslice(new Uint8Array(buffer));

  // Resize with Lanczos3 (high quality)
  const resized = photon.resize(
    img,
    width,
    height,
    photon.SamplingFilter.Lanczos3,
  );

  // Convert to WebP
  const webpBytes = resized.get_bytes_webp();

  // Free WASM memory
  img.free();
  resized.free();

  return Buffer.from(webpBytes);
}
