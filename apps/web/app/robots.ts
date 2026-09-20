import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
        // https://contentsignals.org — public lookups may power search and live AI answers,
        // but not model training.
        other: { "Content-Signal": "search=yes, ai-input=yes, ai-train=no" },
      },
    ],
    sitemap: new URL(
      "/sitemap.xml",
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    ).toString(),
  };
}
