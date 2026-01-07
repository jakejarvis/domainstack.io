import { BASE_URL } from "@/lib/constants/app";
import type { IconSource } from "@/lib/types";

/**
 * Build standard favicon sources (DuckDuckGo, Google, direct attempts)
 * Used by both favicon and provider icon services.
 */
export function buildFaviconSources(domain: string, size = 32): IconSource[] {
  const enc = encodeURIComponent(domain);
  return [
    {
      url: `https://icons.duckduckgo.com/ip3/${enc}.ico`,
      name: "duckduckgo",
    },
    {
      url: `https://www.google.com/s2/favicons?domain=${enc}&sz=${size}`,
      name: "google",
    },
    {
      url: `https://${domain}/favicon.ico`,
      name: "direct_https",
    },
    {
      url: `http://${domain}/favicon.ico`,
      name: "direct_http",
      allowHttp: true,
    },
  ];
}

/**
 * Build icon sources, optionally including Logo.dev as a primary source.
 */
export function buildIconSources(
  domain: string,
  options: {
    size?: number;
    useLogoDev?: boolean;
  } = {},
): IconSource[] {
  const { size = 32, useLogoDev = false } = options;
  const sources: IconSource[] = [];

  // Primary: Logo.dev API (only if requested and API key is configured)
  const logoDevKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  if (useLogoDev && logoDevKey) {
    const enc = encodeURIComponent(domain);
    sources.push({
      url: `https://img.logo.dev/${enc}?token=${logoDevKey}&size=${size}&format=png&fallback=404`,
      name: "logo_dev",
      headers: {
        Referer: BASE_URL,
      },
    });
  }

  // Fallback to standard favicon sources
  sources.push(...buildFaviconSources(domain, size));

  return sources;
}
