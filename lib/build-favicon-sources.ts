import type { IconSource } from "@/lib/fetch-remote-icon";

/**
 * Build standard favicon sources (DuckDuckGo, Google, direct attempts)
 * Used by both favicon and provider logo services as fallbacks.
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
