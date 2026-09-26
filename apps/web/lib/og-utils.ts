export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Neutral background shared by generated social images. */
export const OG_BACKGROUND_IMAGE =
  "radial-gradient(circle at 82% 14%, rgba(99, 102, 241, 0.12), transparent 34%), linear-gradient(135deg, #fbfbfa 0%, #f3f3f0 100%)";

// Load a Google Font from the Google Fonts API
// Adapted from https://github.com/brianlovin/briOS/blob/f72dc33a11194de45c80337b22be4560da62ad7e/src/lib/og-utils.tsx#L32
export async function loadGoogleFont(font: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}`;

  const cssResponse = await fetch(url, {
    next: {
      revalidate: 31_536_000, // 1 year
    },
  });
  if (!cssResponse.ok) {
    throw new Error(`Failed to load font: ${font} ${weight}`);
  }
  const css = await cssResponse.text();
  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

  if (resource) {
    const fontResponse = await fetch(resource[1], {
      next: {
        revalidate: 31_536_000, // 1 year
      },
    });
    if (fontResponse.status === 200) {
      return fontResponse.arrayBuffer();
    }
  }

  throw new Error(`Failed to load font: ${font} ${weight}`);
}
