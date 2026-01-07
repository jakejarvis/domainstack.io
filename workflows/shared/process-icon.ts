/**
 * Shared step for processing icon images (favicon, provider-logo).
 * Converts image buffer to WebP format with specified dimensions.
 */
export async function processIcon(
  imageBase64: string,
  size: number,
): Promise<{ success: true; imageBase64: string } | { success: false }> {
  "use step";

  const { convertBufferToImageCover } = await import("@/lib/image");

  try {
    const buffer = Buffer.from(imageBase64, "base64");

    const webp = await convertBufferToImageCover(
      buffer,
      size,
      size,
      null, // contentType - let sharp detect
    );

    if (!webp || webp.length === 0) {
      return { success: false };
    }

    return {
      success: true,
      imageBase64: webp.toString("base64"),
    };
  } catch {
    return { success: false };
  }
}
