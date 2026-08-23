import type { MetadataRoute } from "next";

/**
 * Public marketing pages that should be discovered by search engines.
 * Auth, dashboard, settings, and per-domain reports are intentionally omitted.
 */
const MARKETING_PATHS = ["/", "/help", "/mcp", "/pricing", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.map((path) => ({
    url: new URL(path, process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
