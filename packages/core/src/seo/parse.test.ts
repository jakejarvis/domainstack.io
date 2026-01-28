/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { parseHtmlMeta, selectPreview } from "./parse";
import { resolveUrlMaybe, sanitizeText } from "./utils";

describe("seo html/meta parsing", () => {
  it("parses and normalizes general, og, and twitter tags", () => {
    const html = `<!doctype html>
    <html><head>
      <title>  My Site  </title>
      <meta name="description" content="  desc  ">
      <link rel="canonical" href="/about">
      <meta name="robots" content=" index,  follow ">

      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Desc" />
      <meta property="og:url" content="/about" />
      <meta property="og:site_name" content="Site" />
      <meta property="og:image" content="/img.png" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="TW Title" />
      <meta name="twitter:description" content="TW Desc" />
      <meta name="twitter:image" content="/tw.jpg" />
    </head><body></body></html>`;

    const meta = parseHtmlMeta(html, "https://example.test/page");
    expect(meta.general.title).toBe("My Site");
    expect(meta.general.description).toBe("desc");
    expect(meta.general.canonical).toBe("https://example.test/about");
    expect(meta.general.robots).toBe("index, follow");

    expect(meta.openGraph.title).toBe("OG Title");
    expect(meta.openGraph.description).toBe("OG Desc");
    expect(meta.openGraph.url).toBe("https://example.test/about");
    expect(meta.openGraph.siteName).toBe("Site");
    expect(meta.openGraph.images).toBeDefined();
    if (!meta.openGraph.images) throw new Error("Expected images");

    expect(meta.openGraph.images[0]).toBe("https://example.test/img.png");

    expect(meta.twitter.card).toBe("summary_large_image");
    expect(meta.twitter.title).toBe("TW Title");
    expect(meta.twitter.description).toBe("TW Desc");
    expect(meta.twitter.image).toBe("https://example.test/tw.jpg");

    const preview = selectPreview(meta, "https://fallback.test/");
    expect(preview.title).toBe("OG Title");
    expect(preview.description).toBe("OG Desc");
    expect(preview.image).toBe("https://example.test/img.png");
    expect(preview.canonicalUrl).toBe("https://example.test/about");
  });

  it("falls back in selectPreview and baseUrl when fields are missing", () => {
    const html = `<!doctype html><html><head>
      <title>Title Only</title>
      <meta name="description" content="General" />
    </head></html>`;
    const meta = parseHtmlMeta(html, "https://ex.org/");
    const preview = selectPreview(meta, "https://ex.org/");
    expect(preview.title).toBe("Title Only");
    expect(preview.description).toBe("General");
    expect(preview.image).toBeNull();
    expect(preview.canonicalUrl).toBe("https://ex.org/");
  });
});

describe("seo helpers", () => {
  it("sanitizeText removes control characters and collapses whitespace", () => {
    const weird = "a\u0007\u000b  b\n\t c";
    expect(sanitizeText(weird)).toBe("a b c");
  });

  it("resolveUrlMaybe returns absolute URLs and null for invalid schemes", () => {
    expect(resolveUrlMaybe("/rel", "https://e.test/base")).toBe(
      "https://e.test/rel",
    );
    expect(resolveUrlMaybe("https://x.test/a", "https://e.test")).toBe(
      "https://x.test/a",
    );
    expect(resolveUrlMaybe("mailto:hi@e.test", "https://e.test")).toBeNull();
    expect(resolveUrlMaybe(undefined, "https://e.test")).toBeNull();
  });
});
