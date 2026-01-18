import { cacheLife } from "next/cache";

// Load a Google Font from the Google Fonts API
// Adapted from https://github.com/brianlovin/briOS/blob/f72dc33a11194de45c80337b22be4560da62ad7e/src/lib/og-utils.tsx#L32
export async function loadGoogleFont(
  font: string,
  weight: number,
): Promise<ArrayBuffer> {
  "use cache";

  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}`;

  const cssResponse = await fetch(url, {
    next: {
      revalidate: 31_536_000, // 1 year
    },
  });
  const css = await cssResponse.text();
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/,
  );

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
