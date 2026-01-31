import "server-only";

import { createLogger } from "@domainstack/logger";
import sharp from "sharp";

const logger = createLogger({ source: "image" });

/**
 * Check if buffer appears to be an ICO (starts with 0x00 0x00 0x01 0x00).
 */
function isIcoBuffer(buffer: Buffer): boolean {
  if (buffer.length < 6) return false;
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  return reserved === 0 && type === 1;
}

export interface OptimizeImageOptions {
  width: number;
  height: number;
  /**
   * Output format (webp, png, or jpeg)
   * @default "webp"
   */
  format?: "webp" | "png" | "jpeg";
  /**
   * Output quality
   * @default 80
   */
  quality?: number;
  /**
   * Resize method (defaults to covering the target area, then center-cropping to maintain aspect ratio)
   *
   * @default "cover"
   * @see https://sharp.pixelplumbing.com/api-resize/#resize
   */
  fit?: sharp.ResizeOptions["fit"];
  /**
   * Sharp instance options
   *
   * @see https://sharp.pixelplumbing.com/api-constructor/#new
   */
  sharpOptions?: sharp.SharpOptions;
}

/**
 * Optimizes an image buffer: resizes and converts to the specified format.
 * Handles ICO files by extracting the best frame using decode-ico.
 *
 * Thanks [@brianlovin](https://github.com/brianlovin/briOS/blob/ebd96b6036e114b98a00a9d6a0fc26f742df1cf4/src/lib/image-processing/ico.ts)
 */
export async function optimizeImage(
  input: Buffer,
  options: OptimizeImageOptions,
): Promise<Buffer> {
  const {
    width,
    height,
    format = "webp",
    quality = 80,
    fit = "cover",
    sharpOptions,
  } = options;
  let imageBuffer = input;

  // Extract best frame from ICO files first
  if (isIcoBuffer(input)) {
    try {
      const decodeIco = (await import("decode-ico")).default;
      const images = decodeIco(input);

      if (images.length > 0) {
        // Sort by: PNG first (better quality), then by resolution (largest first)
        const [chosen] = [...images].sort((a, b) => {
          if (a.type === "png" && b.type !== "png") return -1;
          if (a.type !== "png" && b.type === "png") return 1;
          return b.width * b.height - a.width * a.height;
        });

        if (chosen.type === "png") {
          // PNG data can be used directly
          imageBuffer = Buffer.from(chosen.data);
        } else {
          // BMP type: decode-ico provides raw RGBA data, convert to PNG
          imageBuffer = await sharp(Buffer.from(chosen.data), {
            raw: {
              width: chosen.width,
              height: chosen.height,
              channels: 4,
            },
          })
            .png()
            .toBuffer();
        }
      }
    } catch (err) {
      logger.debug({ err, inputSize: input.length }, "ICO parsing failed");
      // Fall through to try sharp directly on the original input
    }
  }

  const pipeline = sharp(imageBuffer, {
    // Use high density (288 DPI) for crisp SVG rasterization (ignored for raster formats).
    density: 288,
    ...sharpOptions,
  }).resize(width, height, { fit });

  switch (format) {
    case "png":
      return pipeline.png({ quality, compressionLevel: 9 }).toBuffer();
    case "jpeg":
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    default:
      return pipeline.webp({ quality }).toBuffer();
  }
}
