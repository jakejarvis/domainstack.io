import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
      },
    ],
    sitemap: new URL(
      "/sitemap.xml",
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    ).toString(),
  };
}
