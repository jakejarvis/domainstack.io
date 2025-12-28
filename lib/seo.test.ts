/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  parseHtmlMeta,
  parseRobotsTxt,
  resolveUrlMaybe,
  sanitizeText,
  selectPreview,
} from "./seo";

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
    expect(meta.openGraph.images?.[0]).toBe("https://example.test/img.png");

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

describe("robots.txt parsing", () => {
  it("parses groups, rules and sitemaps with comments and case-insensitive keys", () => {
    const text = [
      "User-Agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Crawl-Delay: 10",
      "Sitemap: https://example.test/sitemap.xml",
      "# comment",
      "User-agent: Googlebot",
      "Disallow: /private",
    ].join("\n");

    const robots = parseRobotsTxt(text);
    expect(robots.fetched).toBe(true);
    expect(robots.sitemaps[0]).toBe("https://example.test/sitemap.xml");
    expect(robots.groups.length).toBe(2);
    const any = robots.groups[0];
    expect(any.userAgents).toContain("*");
    expect(any.rules.find((r) => r.type === "allow")?.value).toBe("/");
    expect(any.rules.find((r) => r.type === "disallow")?.value).toBe("/admin");
    expect(any.rules.find((r) => r.type === "crawlDelay")?.value).toBe("10");

    const google = robots.groups[1];
    expect(google.userAgents).toContain("Googlebot");
    expect(google.rules[0]).toEqual({ type: "disallow", value: "/private" });
  });

  it("ignores comments/whitespace and supports CRLF newlines", () => {
    const text = [
      "  # leading comment\r",
      "User-Agent:*  \t # inline ua comment\r",
      "Allow:   /public  # inline allow\r",
      "Disallow:   /private  \r",
      "Crawl-Delay:  5\r",
      "Sitemap: https://a.example/sitemap.xml\r",
      "\r",
      "# another comment\r",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    expect(g.userAgents).toEqual(["*"]);
    expect(g.rules.find((r) => r.type === "allow")?.value).toBe("/public");
    expect(g.rules.find((r) => r.type === "disallow")?.value).toBe("/private");
    expect(g.rules.find((r) => r.type === "crawlDelay")?.value).toBe("5");
    expect(robots.sitemaps).toContain("https://a.example/sitemap.xml");
  });

  it("supports multiple user-agent lines, and starts a new group when user-agent appears after rules", () => {
    const text = [
      "User-agent: Googlebot",
      "User-agent: Bingbot",
      "Disallow: /private",
      "Allow: /public",
      "User-agent: DuckDuckBot",
      "Disallow: /ducks",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.groups.length).toBe(2);
    const g1 = robots.groups[0];
    expect(g1.userAgents).toEqual(["Googlebot", "Bingbot"]);
    expect(g1.rules.find((r) => r.type === "disallow")?.value).toBe("/private");
    expect(g1.rules.find((r) => r.type === "allow")?.value).toBe("/public");
    const g2 = robots.groups[1];
    expect(g2.userAgents).toEqual(["DuckDuckBot"]);
    expect(g2.rules[0]).toEqual({ type: "disallow", value: "/ducks" });
  });

  it("parses content-signal directive with case-insensitive keys", () => {
    const text = [
      "User-Agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Content-Signal: https://example.test/content-signal.json",
      "User-agent: Googlebot",
      "content-signal: no-ai-training",
    ].join("\n");

    const robots = parseRobotsTxt(text);
    expect(robots.fetched).toBe(true);
    expect(robots.groups.length).toBe(2);
    const any = robots.groups[0];
    expect(any.userAgents).toContain("*");
    expect(any.rules.find((r) => r.type === "contentSignal")?.value).toBe(
      "https://example.test/content-signal.json",
    );

    const google = robots.groups[1];
    expect(google.userAgents).toContain("Googlebot");
    expect(google.rules.find((r) => r.type === "contentSignal")?.value).toBe(
      "no-ai-training",
    );
  });

  it("parses keys case-insensitively and tolerates spacing around colon", () => {
    const text = ["uSeR-AgEnT :*", "DISALLOW:   /Admin", "allow:/"].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    expect(g.userAgents).toEqual(["*"]);
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/Admin"),
    ).toBe(true);
    expect(g.rules.some((r) => r.type === "allow" && r.value === "/")).toBe(
      true,
    );
  });

  it("ignores unknown directives", () => {
    const text = ["User-agent:*", "Foo: bar", "Disallow: /x", "Bar: baz"].join(
      "\n",
    );
    const robots = parseRobotsTxt(text);
    const g = robots.groups[0];
    expect(g.rules.length).toBe(1);
    expect(g.rules[0]).toEqual({ type: "disallow", value: "/x" });
  });

  it("accumulates multiple Sitemap directives anywhere in the file", () => {
    const text = [
      "Sitemap: https://a.example/sitemap.xml",
      "User-agent:*",
      "Disallow: /private",
      "Sitemap: https://a.example/sitemap-news.xml",
    ].join("\n");
    const robots = parseRobotsTxt(text, {
      baseUrl: "https://a.example/robots.txt",
    });
    expect(robots.sitemaps).toEqual([
      "https://a.example/sitemap.xml",
      "https://a.example/sitemap-news.xml",
    ]);
  });

  it("dedupes and resolves relative sitemaps with baseUrl, ignoring invalid schemes", () => {
    const text = [
      "Sitemap: /sitemap.xml",
      "Sitemap: /sitemap.xml", // duplicate
      "Sitemap: ftp://example.test/ignored.xml", // non-http(s), ignored
      "User-agent:*",
      "Disallow: /x",
    ].join("\n");
    const robots = parseRobotsTxt(text, {
      baseUrl: "https://a.example/robots.txt",
    });
    expect(robots.sitemaps).toEqual(["https://a.example/sitemap.xml"]);
  });

  it("treats blank line between explicit UA groups as separator (still two groups)", () => {
    const text = [
      "User-agent: a",
      "Disallow: /one",
      "",
      "User-agent: b",
      "Disallow: /two",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.groups.length).toBe(2);
    expect(robots.groups[0].userAgents).toEqual(["a"]);
    expect(robots.groups[1].userAgents).toEqual(["b"]);
  });

  it("collects Sitemap inside group globally (not scoped to group)", () => {
    const text = [
      "User-agent: a",
      "Sitemap: https://example.test/x.xml",
      "Disallow: /a",
      "User-agent: b",
      "Disallow: /b",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.sitemaps).toEqual(["https://example.test/x.xml"]);
    expect(robots.groups.length).toBe(2);
  });

  it("caps parsing size to ~500KiB without throwing", () => {
    const big = "#".repeat(600 * 1024);
    const text = `User-agent: *\nDisallow: /x\n${big}\nAllow: /y`;
    const robots = parseRobotsTxt(text, { sizeCapBytes: 500 * 1024 });
    expect(robots.fetched).toBe(true);
    // Exact presence of trailing rule after cap is implementation-defined; ensure no crash
    expect(Array.isArray(robots.groups)).toBe(true);
  });

  it("preserves wildcard and anchor characters in values", () => {
    const text = ["User-agent:*", "Disallow: /*.php$", "Allow: /search/*"].join(
      "\n",
    );
    const robots = parseRobotsTxt(text);
    const g = robots.groups[0];
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/*.php$"),
    ).toBe(true);
    expect(
      g.rules.some((r) => r.type === "allow" && r.value === "/search/*"),
    ).toBe(true);
  });

  it("handles unicode in values and strips invisibles in lines", () => {
    const text = [
      "User-agent:*",
      "Allow: /caf\u00E9/\u8DEF\u5F84",
      "Disallow: /private\u200B",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    const g = robots.groups[0];
    expect(
      g.rules.some(
        (r) => r.type === "allow" && r.value === "/caf3/\u8DEF\u5F84",
      ),
    ).toBe(false); // sanity check for encoding mistake
    expect(
      g.rules.some(
        (r) => r.type === "allow" && r.value === "/caf\u00E9/\u8DEF\u5F84",
      ),
    ).toBe(true);
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/private"),
    ).toBe(true);
  });

  it("ignores rules before any user-agent group", () => {
    const text = [
      "Disallow: /x",
      "Allow: /",
      "User-agent:*",
      "Disallow: /y",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    expect(g.rules.length).toBe(1);
    expect(g.rules[0]).toEqual({ type: "disallow", value: "/y" });
  });

  it("parses last group without trailing newline at EOF", () => {
    const text = "User-agent:*\nAllow:/public\nDisallow:/private"; // no trailing NL
    const robots = parseRobotsTxt(text, {
      baseUrl: "https://e.test/robots.txt",
    });
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    expect(g.userAgents).toEqual(["*"]);
    expect(
      g.rules.some((r) => r.type === "allow" && r.value === "/public"),
    ).toBe(true);
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/private"),
    ).toBe(true);
  });

  it("combines duplicate user-agent groups (e.g., multiple all-* groups)", () => {
    const text = [
      "Sitemap: https://wordpress.org/sitemap.xml",
      "User-agent: *",
      "Disallow: /wp-admin/",
      "Allow: /wp-admin/admin-ajax.php",
      "",
      "User-agent: *",
      "Disallow: /search",
      "Disallow: /?s=",
      "",
      "User-agent: *",
      "Disallow: /plugins/search/",
    ].join("\n");
    const robots = parseRobotsTxt(text, {
      baseUrl: "https://wordpress.org/robots.txt",
    });
    expect(robots.sitemaps).toContain("https://wordpress.org/sitemap.xml");
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    expect(g.userAgents).toEqual(["*"]);
    // Should contain all rules from the three groups
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/wp-admin/"),
    ).toBe(true);
    expect(
      g.rules.some(
        (r) => r.type === "allow" && r.value === "/wp-admin/admin-ajax.php",
      ),
    ).toBe(true);
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/search"),
    ).toBe(true);
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/?s="),
    ).toBe(true);
    expect(
      g.rules.some(
        (r) => r.type === "disallow" && r.value === "/plugins/search/",
      ),
    ).toBe(true);
  });

  it("deduplicates identical rules within a merged group while preserving order", () => {
    const text = [
      "User-agent: *",
      "Disallow: /private",
      "Disallow: /private", // duplicate
      "Allow: /public",
      "",
      "User-agent: *",
      "Allow: /public", // duplicate from later group
      "Disallow: /private", // duplicate again
    ].join("\n");
    const robots = parseRobotsTxt(text, {
      baseUrl: "https://dup.example/robots.txt",
    });
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    const disallows = g.rules.filter((r) => r.type === "disallow");
    const allows = g.rules.filter((r) => r.type === "allow");
    expect(disallows.length).toBe(1);
    expect(allows.length).toBe(1);
    expect(disallows[0].value).toBe("/private");
    expect(allows[0].value).toBe("/public");
  });

  it("handles blank line and comments after User-agent and parses vercel-style sample", () => {
    const text = [
      "User-Agent: *",
      "",
      "# Allow robots to be able to crawl the OG Image API route and all the subpaths",
      "Allow: /api/og/*",
      "Allow: /api/product-og*",
      "Allow: /api/templates/og*",
      "Allow: /api/dynamic-og*",
      "Allow: /api/www/avatar/*",
      "",
      "Disallow:",
      "Disallow: /api/",
      "Disallow: /oauth",
      "",
      "Sitemap: https://vercel.test/sitemap.xml",
    ].join("\n");

    const robots = parseRobotsTxt(text, {
      baseUrl: "https://vercel.test/robots.txt",
    });
    expect(robots.fetched).toBe(true);
    expect(robots.sitemaps).toContain("https://vercel.test/sitemap.xml");
    expect(robots.groups.length).toBe(1);
    const any = robots.groups[0];
    expect(any.userAgents).toEqual(["*"]);
    // empty Disallow captured as a rule with empty value
    expect(any.rules.some((r) => r.type === "disallow" && r.value === "")).toBe(
      true,
    );
    // a few representative rules parsed
    expect(
      any.rules.some((r) => r.type === "allow" && r.value === "/api/og/*"),
    ).toBe(true);
    expect(
      any.rules.some((r) => r.type === "disallow" && r.value === "/api/"),
    ).toBe(true);
  });

  it("captures empty Disallow explicitly and non-empty alongside it", () => {
    const text = [
      "User-agent: *",
      "Disallow:",
      "Disallow: /admin",
      "Allow: /",
    ].join("\n");
    const robots = parseRobotsTxt(text);
    const g = robots.groups[0];
    const empty = g.rules.find((r) => r.type === "disallow" && r.value === "");
    expect(empty).toBeTruthy();
    expect(
      g.rules.some((r) => r.type === "disallow" && r.value === "/admin"),
    ).toBe(true);
  });

  it("tolerates BOM at the start of file before first directive", () => {
    const text = ["\uFEFFUser-agent: *", "Disallow: /private"].join("\n");
    const robots = parseRobotsTxt(text);
    expect(robots.groups.length).toBe(1);
    const g = robots.groups[0];
    expect(g.userAgents).toEqual(["*"]);
    expect(g.rules[0]).toEqual({ type: "disallow", value: "/private" });
  });
});
