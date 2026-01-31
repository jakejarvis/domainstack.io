/**
 * HTML meta tag parsing for SEO data extraction.
 */

import type {
  GeneralMeta,
  OpenGraphMeta,
  SeoMeta,
  SeoPreview,
  TwitterMeta,
} from "@domainstack/types";
import * as cheerio from "cheerio";
import { resolveUrlMaybe, sanitizeText } from "./utils";

/**
 * Parse HTML and extract SEO metadata (general, OpenGraph, Twitter).
 *
 * @param html - Raw HTML string to parse
 * @param finalUrl - The final URL after redirects (used for resolving relative URLs)
 * @returns Structured SEO metadata
 */
export function parseHtmlMeta(html: string, finalUrl: string): SeoMeta {
  const $ = cheerio.load(html);

  const titleTag = sanitizeText($("title").first().text());
  const descriptionTag = sanitizeText(
    $('meta[name="description"]').attr("content") ?? "",
  );
  const canonicalHref = $('link[rel="canonical"]').attr("href") ?? "";
  const robotsMeta = $('meta[name="robots"]').attr("content") ?? "";
  const generatorMeta = $('meta[name="generator"]').attr("content") ?? "";
  const authorMeta = $('meta[name="author"]').attr("content") ?? "";
  const keywordsMeta = $('meta[name="keywords"]').attr("content") ?? "";

  const og: OpenGraphMeta = {
    title: pickMetaAttr($, "property", "og:title"),
    description: pickMetaAttr($, "property", "og:description"),
    type: pickMetaAttr($, "property", "og:type"),
    url: pickMetaAttr($, "property", "og:url"),
    siteName: pickMetaAttr($, "property", "og:site_name"),
    images: Array.from(
      new Set([
        ...collectMetaMulti($, "property", "og:image"),
        ...collectMetaMulti($, "property", "og:image:url"),
        ...collectMetaMulti($, "property", "og:image:secure_url"),
      ]),
    ),
  };

  const tw: TwitterMeta = {
    card: pickMetaAttr($, "name", "twitter:card"),
    title: pickMetaAttr($, "name", "twitter:title"),
    description: pickMetaAttr($, "name", "twitter:description"),
    image:
      pickMetaAttr($, "name", "twitter:image") ??
      pickMetaAttr($, "name", "twitter:image:src"),
  };

  const general: GeneralMeta = {
    title: titleTag || undefined,
    description: descriptionTag || undefined,
    keywords: sanitizeText(keywordsMeta) || undefined,
    author: sanitizeText(authorMeta) || undefined,
    canonical: sanitizeText(canonicalHref) || undefined,
    generator: sanitizeText(generatorMeta) || undefined,
    robots: sanitizeText(robotsMeta) || undefined,
  };

  general.canonical =
    resolveUrlMaybe(general.canonical, finalUrl) ?? general.canonical;
  og.url = resolveUrlMaybe(og.url, finalUrl) ?? og.url;
  og.images = og.images
    ?.map((i) => resolveUrlMaybe(i, finalUrl))
    .filter(Boolean) as string[];
  if (tw.image) tw.image = resolveUrlMaybe(tw.image, finalUrl) ?? tw.image;

  return {
    openGraph: og,
    twitter: tw,
    general,
  };
}

/**
 * Extract a single meta tag attribute value.
 */
function pickMetaAttr(
  $: cheerio.CheerioAPI,
  attr: "name" | "property",
  key: string,
): string | undefined {
  const value = $(`meta[${attr}="${key}"]`).attr("content") ?? "";
  const s = sanitizeText(value);
  return s === "" ? undefined : s;
}

/**
 * Collect multiple meta tag values (e.g., multiple og:image tags).
 */
function collectMetaMulti(
  $: cheerio.CheerioAPI,
  attr: "name" | "property",
  key: string,
): string[] {
  const out: string[] = [];
  $(`meta[${attr}="${key}"]`).each((_i, el) => {
    const v = sanitizeText($(el).attr("content") ?? "");
    if (v) out.push(v);
  });
  return out;
}

/**
 * Select the best preview data from SEO metadata with fallback chain.
 *
 * Priority: OpenGraph > Twitter > General meta tags
 *
 * @param meta - Parsed SEO metadata (or null)
 * @param finalUrl - Fallback URL if no canonical is found
 * @returns Preview data for social sharing
 */
export function selectPreview(
  meta: SeoMeta | null,
  finalUrl: string,
): SeoPreview {
  const title =
    meta?.openGraph.title || meta?.twitter.title || meta?.general.title || null;
  const description =
    meta?.openGraph.description ||
    meta?.twitter.description ||
    meta?.general.description ||
    null;
  const image = meta?.openGraph.images?.[0] || meta?.twitter.image || null;
  const canonicalUrl =
    meta?.general.canonical || meta?.openGraph.url || finalUrl;
  return { title, description, image, imageUploaded: null, canonicalUrl };
}

/**
 * Extract all values of a specific meta tag by name.
 *
 * Useful for verification tokens where multiple users may have tags on the same page.
 *
 * @param html - Raw HTML string to parse
 * @param metaName - The meta tag name attribute to search for
 * @returns Array of content values found
 */
export function extractMetaTagValues(html: string, metaName: string): string[] {
  const $ = cheerio.load(html);
  const values: string[] = [];

  $(`meta[name="${metaName}"]`).each((_, element) => {
    const content = $(element).attr("content")?.trim();
    if (content) {
      values.push(content);
    }
  });

  return values;
}
