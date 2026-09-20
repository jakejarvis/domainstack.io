import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { REPOSITORY_SLUG } from "@domainstack/constants";

/**
 * Homepage structured data (https://schema.org): the site, its search box, and
 * the web app itself. `SearchAction` targets the `/?q=` redirect handled in
 * `proxy.ts`.
 */
export function buildHomeJsonLd(baseUrl: string) {
  const home = new URL("/", baseUrl).toString();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        url: home,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        potentialAction: {
          "@type": "SearchAction",
          target: `${home}?q={query}`,
          query: "required",
        },
      },
      {
        "@type": "WebApplication",
        "@id": `${home}#webapp`,
        url: home,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        sameAs: [
          `https://github.com/${REPOSITORY_SLUG}`,
          "https://bsky.app/profile/domainstack.io",
          "https://x.com/getdomainstack",
        ],
      },
    ],
  };
}
