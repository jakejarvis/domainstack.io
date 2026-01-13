import "server-only";

import sharp from "sharp";

import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "image" });

/**
 * Check if buffer appears to be an ICO (starts with 0x00 0x00 0x01 0x00).
 */
function isIcoBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x00 &&
    buf[1] === 0x00 &&
    buf[2] === 0x01 &&
    buf[3] === 0x00
  );
}

/**
 * Check if buffer appears to be an SVG (starts with XML or SVG tag).
 */
function isSvgBuffer(buf: Buffer): boolean {
  // SVGs typically start with <?xml, <svg, or whitespace followed by these
  const head = buf.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<?xml") || head.startsWith("<svg");
}

/**
 * Converts an image buffer to WebP format with cover cropping.
 * Handles ICO files by extracting the best frame using icojs.
 * Handles SVG files with explicit density for proper rasterization.
 */
export async function convertBufferToImageCover(
  input: Buffer,
  width: number,
  height: number,
  contentTypeHint?: string | null,
): Promise<Buffer | null> {
  const isSvg =
    isSvgBuffer(input) || (contentTypeHint && /svg/.test(contentTypeHint));

  // SVGs need special handling with explicit density for proper rasterization
  if (isSvg) {
    try {
      return await optimizeSvgCover(input, width, height);
    } catch (err) {
      logger.debug(
        { err, inputSize: input.length },
        "SVG processing failed, trying standard path",
      );
      // Fall through to try standard processing
    }
  }

  // Try standard sharp processing first
  try {
    return await optimizeImageCover(input, width, height);
  } catch (err) {
    logger.debug(
      { err, inputSize: input.length, contentTypeHint },
      "standard sharp processing failed, trying fallbacks",
    );
  }

  // ICO fallback
  if (isIcoBuffer(input) || (contentTypeHint && /icon/.test(contentTypeHint))) {
    try {
      type IcoFrame = {
        width: number;
        height: number;
        buffer?: ArrayBuffer;
        data?: ArrayBuffer;
      };
      const mod = (await import("icojs")) as unknown as {
        parse: (buf: ArrayBuffer, outputType?: string) => Promise<IcoFrame[]>;
      };
      const arr = (input.buffer as ArrayBuffer).slice(
        input.byteOffset,
        input.byteOffset + input.byteLength,
      ) as ArrayBuffer;
      const frames = await mod.parse(arr as ArrayBuffer, "image/png");
      if (Array.isArray(frames) && frames.length > 0) {
        let [chosen] = frames;
        chosen = frames.reduce((best: IcoFrame, cur: IcoFrame) => {
          const bw = Number(best?.width ?? 0);
          const bh = Number(best?.height ?? 0);
          const cw = Number(cur?.width ?? 0);
          const ch = Number(cur?.height ?? 0);
          // Manhattan distance to target rectangle for better rectangular fit
          const bDelta = Math.abs(bw - width) + Math.abs(bh - height);
          const cDelta = Math.abs(cw - width) + Math.abs(ch - height);
          return cDelta < bDelta ? cur : best;
        }, chosen);

        const arrBuf: ArrayBuffer | undefined = chosen.buffer ?? chosen.data;
        if (arrBuf) {
          const pngBuf = Buffer.from(arrBuf);
          return await optimizeImageCover(pngBuf, width, height);
        }
      }
    } catch (err) {
      logger.debug({ err, inputSize: input.length }, "ICO parsing failed");
    }
  }

  logger.warn(
    { inputSize: input.length, contentTypeHint },
    "all image processing attempts failed",
  );
  return null;
}

/**
 * Resizes and crops an image buffer to WebP format using "cover" logic.
 * Maintains aspect ratio by scaling to cover the target area, then center-cropping.
 */
export async function optimizeImageCover(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Rasterizes an SVG buffer to WebP format with explicit density.
 * SVGs require explicit density settings to render at the correct size.
 */
async function optimizeSvgCover(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  // Use high density (72 * 4 = 288 DPI) for crisp rasterization,
  // then resize down to target dimensions
  return sharp(buffer, { density: 288 })
    .resize(width, height, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
}
