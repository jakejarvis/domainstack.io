/**
 * HTML meta tag parsing for SEO data extraction.
 */

import * as cheerio from "cheerio";

import type {
  GeneralMeta,
  OpenGraphMeta,
  SeoMeta,
  SeoPreview,
  TwitterMeta,
} from "@domainstack/types";

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
  const meta = indexMetaTags($);

  const og: OpenGraphMeta = {
    title: pickMeta(meta, "og:title"),
    description: pickMeta(meta, "og:description"),
    type: pickMeta(meta, "og:type"),
    url: pickMeta(meta, "og:url"),
    siteName: pickMeta(meta, "og:site_name"),
    images: Array.from(
      new Set([
        ...collectMeta(meta, "og:image"),
        ...collectMeta(meta, "og:image:url"),
        ...collectMeta(meta, "og:image:secure_url"),
      ]),
    ),
  };

  const tw: TwitterMeta = {
    card: pickMeta(meta, "twitter:card"),
    title: pickMeta(meta, "twitter:title"),
    description: pickMeta(meta, "twitter:description"),
    image: pickMeta(meta, "twitter:image") ?? pickMeta(meta, "twitter:image:src"),
  };

  const general: GeneralMeta = {
    title: sanitizeText($("title").first().text()) || undefined,
    description: pickMeta(meta, "description"),
    keywords: pickMeta(meta, "keywords"),
    author: pickMeta(meta, "author"),
    canonical: findCanonicalHref($) || undefined,
    generator: pickMeta(meta, "generator"),
    robots: pickMeta(meta, "robots"),
  };

  general.canonical = resolveUrlMaybe(general.canonical, finalUrl) ?? general.canonical;
  og.url = resolveUrlMaybe(og.url, finalUrl) ?? og.url;
  og.images = og.images?.flatMap((i) => {
    const resolved = resolveUrlMaybe(i, finalUrl);
    return resolved ? [resolved] : [];
  });
  if (tw.image) tw.image = resolveUrlMaybe(tw.image, finalUrl) ?? tw.image;

  return {
    openGraph: og,
    twitter: tw,
    general,
  };
}

/**
 * Index every meta tag by its `name` or `property` key.
 *
 * Keys are lowercased because HTML attribute values are case-sensitive to CSS
 * selectors but not to publishers, and OpenGraph tags are commonly authored
 * with `name` instead of `property` (and vice versa for Twitter tags).
 */
function indexMetaTags($: cheerio.CheerioAPI): Map<string, string[]> {
  const index = new Map<string, string[]>();

  $("meta").each((_i, el) => {
    const attribs = el.attribs ?? {};
    const key = (attribs.name ?? attribs.property ?? "").trim().toLowerCase();
    if (!key) return;

    const value = sanitizeText(attribs.content ?? "");
    if (!value) return;

    const existing = index.get(key);
    if (existing) {
      existing.push(value);
    } else {
      index.set(key, [value]);
    }
  });

  return index;
}

/**
 * Read the first value for a meta key.
 */
function pickMeta(index: Map<string, string[]>, key: string): string | undefined {
  return index.get(key)?.[0];
}

/**
 * Read every value for a meta key (e.g., multiple og:image tags).
 */
function collectMeta(index: Map<string, string[]>, key: string): string[] {
  return index.get(key) ?? [];
}

/**
 * Find the canonical link href, tolerating case and multi-token `rel` values.
 */
function findCanonicalHref($: cheerio.CheerioAPI): string {
  let href = "";

  $("link[rel]").each((_i, el) => {
    if (href) return;
    const rel = el.attribs?.rel ?? "";
    const isCanonical = rel
      .split(/\s+/)
      .some((token) => token.trim().toLowerCase() === "canonical");
    if (isCanonical) {
      href = sanitizeText(el.attribs?.href ?? "");
    }
  });

  return href;
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
export function selectPreview(meta: SeoMeta | null, finalUrl: string): SeoPreview {
  const title = meta?.openGraph.title || meta?.twitter.title || meta?.general.title || null;
  const description =
    meta?.openGraph.description || meta?.twitter.description || meta?.general.description || null;
  const image = meta?.openGraph.images?.[0] || meta?.twitter.image || null;
  const canonicalUrl = meta?.general.canonical || meta?.openGraph.url || finalUrl;
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
  return collectMeta(indexMetaTags($), metaName.trim().toLowerCase());
}

const UTF16_LABELS = new Set(["utf-16", "utf-16le", "utf-16be"]);

/**
 * Decode an HTML response body using its declared charset: the Content-Type
 * `charset` parameter first, then a `<meta charset>` / `http-equiv` sniff of
 * the first 1024 bytes, then UTF-8. Unknown labels fall back to UTF-8.
 *
 * A UTF-16 label found by the meta sniff is treated as UTF-8: the tag was
 * readable as ASCII, so the document cannot actually be UTF-16 (WHATWG HTML
 * encoding sniffing).
 *
 * @param buffer - Raw response body
 * @param contentType - Raw `Content-Type` header value, if any
 * @returns The decoded HTML string
 */
export function decodeHtml(buffer: Buffer, contentType: string | null): string {
  let label = /charset\s*=\s*["']?\s*([^\s;"']+)/i.exec(contentType ?? "")?.[1];

  if (!label) {
    const sniffed = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(
      buffer.subarray(0, 1024).toString("latin1"),
    )?.[1];
    if (sniffed) {
      label = UTF16_LABELS.has(sniffed.toLowerCase()) ? "utf-8" : sniffed;
    }
  }

  try {
    return new TextDecoder(label ?? "utf-8", { fatal: false }).decode(buffer);
  } catch {
    // Unknown encoding label (RangeError).
    return buffer.toString("utf-8");
  }
}
