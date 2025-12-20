import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: new Date(),
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
    },
  ];
}
