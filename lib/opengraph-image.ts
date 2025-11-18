import fs from "node:fs/promises";
import path from "node:path";

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

const GEIST_DIR = path.join(
  process.cwd(),
  "node_modules/geist/dist/fonts/geist-sans",
);

// ── Fonts: Geist from package → Google → error
async function loadGeistFromPackage() {
  try {
    const [regular, semibold] = await Promise.all([
      fs.readFile(path.join(GEIST_DIR, "Geist-Regular.ttf")),
      fs.readFile(path.join(GEIST_DIR, "Geist-SemiBold.ttf")),
    ]);
    return [
      {
        name: "Geist",
        data: regular,
        weight: 400 as const,
        style: "normal" as const,
      },
      {
        name: "Geist",
        data: semibold,
        weight: 600 as const,
        style: "normal" as const,
      },
    ];
  } catch {
    return null;
  }
}

async function fetchGoogleWoff2(cssUrl: string) {
  const cssRes = await fetch(cssUrl);
  if (!cssRes.ok) throw new Error(`Font CSS fetch failed: ${cssUrl}`);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((https:[^)]+\.woff2)\)/);
  if (!match?.[1]) throw new Error(`No .woff2 URL found in CSS: ${cssUrl}`);
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`Font binary fetch failed: ${match[1]}`);
  return fontRes.arrayBuffer();
}

async function loadGeistFromGoogle() {
  try {
    const regular = await fetchGoogleWoff2(
      "https://fonts.googleapis.com/css2?family=Geist:wght@400&display=swap",
    );
    const semibold = await fetchGoogleWoff2(
      "https://fonts.googleapis.com/css2?family=Geist:wght@600&display=swap",
    );
    return [
      {
        name: "Geist",
        data: regular,
        weight: 400 as const,
        style: "normal" as const,
      },
      {
        name: "Geist",
        data: semibold,
        weight: 600 as const,
        style: "normal" as const,
      },
    ];
  } catch {
    return null;
  }
}

export async function loadFontsForOG() {
  const pkg = await loadGeistFromPackage();
  if (pkg?.length) return pkg;

  const ggl = await loadGeistFromGoogle();
  if (ggl?.length) return ggl;

  throw new Error(
    "OG font load failed: Could not load Geist from the `geist` package or Google Fonts.",
  );
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
