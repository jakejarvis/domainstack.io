import { cacheLife } from "next/cache";

// ── Brand palette
export const BRAND = {
  bg: "#0B0D10",
  fg: "#EAEFF7",
  sub: "#AAB3C2",
  chipBg: "rgba(255,255,255,0.06)",
  chipBorder: "rgba(255,255,255,0.12)",
  // accents used for glows
  a: "rgba(124, 92, 252, 0.28)", // purple
  b: "rgba(0, 212, 255, 0.24)", // cyan
  c: "rgba(34, 197, 94, 0.20)", // green
};

// Chips + per-chip colors (soft tints)
export const CHIPS = [
  { label: "Registration", color: "#7C5CFC" },
  { label: "DNS", color: "#00D4FF" },
  { label: "Hosting", color: "#22C55E" },
  { label: "Email", color: "#60A5FA" },
  { label: "Certificates", color: "#F472B6" },
  { label: "Headers", color: "#F59E0B" },
  { label: "SEO", color: "#2DD4BF" },
  { label: "Open Graph", color: "#A3E635" },
];

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
      revalidate: 31536000, // 1 year
    },
  });
  const css = await cssResponse.text();
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/,
  );

  if (resource) {
    const fontResponse = await fetch(resource[1], {
      next: {
        revalidate: 31536000, // 1 year
      },
    });
    if (fontResponse.status === 200) {
      cacheLife("max"); // cache indefinitely if successful
      return fontResponse.arrayBuffer();
    }
  }

  throw new Error(`Failed to load font: ${font} ${weight}`);
}

// ── Utilities
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

export const cacheHeaders = {
  "Cache-Control": "public, max-age=3600",
  "Vercel-CDN-Cache-Control":
    "public, s-maxage=604800, stale-while-revalidate=86400",
};
