import "server-only";

function isIcoBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x00 &&
    buf[1] === 0x00 &&
    buf[2] === 0x01 &&
    buf[3] === 0x00
  );
}

export async function convertBufferToImageCover(
  input: Buffer,
  width: number,
  height: number,
  contentTypeHint?: string | null,
): Promise<Buffer | null> {
  try {
    return await optimizeImageCover(input, width, height);
  } catch {
    // ignore and try ICO-specific decode if it looks like ICO
  }

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
        let chosen: IcoFrame = frames[0];
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
    } catch {
      // Fall through to null
    }
  }

  return null;
}

export async function optimizeImageCover(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return await sharp(buffer)
    .resize(width, height, { fit: "cover" })
    .webp({})
    .toBuffer();
}

export async function addWatermarkToScreenshot(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const watermarkText = "domainstack.io";
  const fontSize = Math.max(24, Math.floor(width / 100)); // Scale font with image size
  const padding = Math.floor(fontSize * 0.8);

  // Create SVG watermark text
  const watermarkSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${width - padding}" y="${height - padding}" 
            text-anchor="end" 
            dominant-baseline="alphabetic"
            font-family="Arial, sans-serif" 
            font-size="${fontSize}" 
            fill="rgba(255,255,255,0.4)" 
            stroke="rgba(0,0,0,0.2)" 
            stroke-width="0.5">
        ${watermarkText}
      </text>
    </svg>
  `;

  const watermarkBuffer = Buffer.from(watermarkSvg);

  const sharp = (await import("sharp")).default;
  return await sharp(buffer)
    .resize(width, height, { fit: "cover" })
    .composite([
      {
        input: watermarkBuffer,
        blend: "over",
      },
    ])
    .webp({})
    .toBuffer();
}
