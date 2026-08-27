import { cacheLife } from "next/cache";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Dark geometric background used by default and per-domain OG images. */
export const OG_BACKGROUND_IMAGE =
  "linear-gradient(346deg, rgba(55, 55, 55,0.04) 0%, rgba(55, 55, 55,0.04) 22%,rgba(140, 140, 140,0.04) 22%, rgba(140, 140, 140,0.04) 69%,rgba(225, 225, 225,0.04) 69%, rgba(225, 225, 225,0.04) 100%),linear-gradient(31deg, rgba(55, 55, 55,0.04) 0%, rgba(55, 55, 55,0.04) 42%,rgba(140, 140, 140,0.04) 42%, rgba(140, 140, 140,0.04) 85%,rgba(225, 225, 225,0.04) 85%, rgba(225, 225, 225,0.04) 100%),linear-gradient(55deg, rgba(55, 55, 55,0.04) 0%, rgba(55, 55, 55,0.04) 13%,rgba(140, 140, 140,0.04) 13%, rgba(140, 140, 140,0.04) 72%,rgba(225, 225, 225,0.04) 72%, rgba(225, 225, 225,0.04) 100%),linear-gradient(90deg, rgb(0,0,0),rgb(0,0,0))";

// Load a Google Font from the Google Fonts API
// Adapted from https://github.com/brianlovin/briOS/blob/f72dc33a11194de45c80337b22be4560da62ad7e/src/lib/og-utils.tsx#L32
export async function loadGoogleFont(font: string, weight: number): Promise<ArrayBuffer> {
  "use cache";

  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}`;

  const cssResponse = await fetch(url, {
    next: {
      revalidate: 31_536_000, // 1 year
    },
  });
  const css = await cssResponse.text();
  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

  if (resource) {
    const fontResponse = await fetch(resource[1], {
      next: {
        revalidate: 31_536_000, // 1 year
      },
    });
    if (fontResponse.status === 200) {
      cacheLife("max"); // cache indefinitely if successful
      return fontResponse.arrayBuffer();
    }
  }

  throw new Error(`Failed to load font: ${font} ${weight}`);
}

export function hexToRGBA(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
