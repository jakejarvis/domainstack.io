import * as cheerio from "cheerio";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsGroup,
  RobotsRule,
  RobotsTxt,
  SeoMeta,
  SeoPreview,
  TwitterMeta,
} from "@/lib/types";

export function sanitizeText(input: unknown): string {
  let out = String(input ?? "");
  out = out.trim().replace(/\s+/g, " ");
  let res = "";
  for (let i = 0; i < out.length; i++) {
    const code = out.charCodeAt(i);
    if (
      (code >= 0 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      continue;
    }
    res += out[i] as string;
  }
  // Strip invisible formatting chars (ZWSP, bidi marks, BOM)
  return res.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
}

export function resolveUrlMaybe(
  value: string | undefined,
  baseUrl: string,
): string | null {
  if (!value) return null;
  try {
    const u = new URL(value, baseUrl);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

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

function pickMetaAttr(
  $: cheerio.CheerioAPI,
  attr: "name" | "property",
  key: string,
): string | undefined {
  const value = $(`meta[${attr}="${key}"]`).attr("content") ?? "";
  const s = sanitizeText(value);
  return s === "" ? undefined : s;
}

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

export function parseRobotsTxt(
  text: string,
  opts?: { baseUrl?: string; sizeCapBytes?: number },
): RobotsTxt {
  // Cap processing to avoid huge files (align with Google ~500 KiB)
  const capBytes = opts?.sizeCapBytes ?? 500 * 1024;
  const capped = text.length > capBytes ? text.slice(0, capBytes) : text;
  const lines = capped.split(/\r?\n/);
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const sitemapSeen = new Set<string>();

  let currentAgents: string[] = [];
  let currentRules: RobotsRule[] = [];

  function flushGroup() {
    if (currentAgents.length > 0) {
      groups.push({
        userAgents: currentAgents.slice(),
        rules: currentRules.slice(),
      });
      currentAgents = [];
      currentRules = [];
    }
  }

  for (const rawLine of lines) {
    // Remove invisible Unicode control chars (including BOM) before parsing
    const cleaned = rawLine.replace(
      /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,
      "",
    );
    const line = cleaned.split("#")[0]?.trim() ?? "";
    if (line === "") {
      // Treat blank lines as whitespace; do not flush the current group
      continue;
    }
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = sanitizeText(line.slice(idx + 1));

    if (key === "user-agent") {
      // Start a new group if we already collected rules; consecutive UA lines share the same group
      if (currentAgents.length > 0 && currentRules.length > 0) flushGroup();
      if (value) currentAgents.push(value);
      continue;
    }
    if (key === "allow") {
      if (currentAgents.length > 0) currentRules.push({ type: "allow", value });
      continue;
    }
    if (key === "disallow") {
      if (currentAgents.length > 0)
        currentRules.push({ type: "disallow", value });
      continue;
    }
    if (key === "crawl-delay") {
      if (currentAgents.length > 0)
        currentRules.push({ type: "crawlDelay", value });
      continue;
    }
    if (key === "content-signal") {
      if (currentAgents.length > 0)
        currentRules.push({ type: "contentSignal", value });
      continue;
    }
    if (key === "sitemap") {
      if (value) {
        let url = value;
        if (opts?.baseUrl) {
          try {
            const abs = new URL(value, opts.baseUrl);
            if (abs.protocol === "http:" || abs.protocol === "https:") {
              url = abs.toString();
            } else {
              // Ignore non-http(s)
              url = "";
            }
          } catch {
            // Ignore invalid URL
            url = "";
          }
        }
        if (url && !sitemapSeen.has(url)) {
          sitemapSeen.add(url);
          sitemaps.push(url);
        }
      }
    }
  }
  flushGroup();

  // Merge duplicate user-agent groups (e.g., multiple "User-agent: *" groups)
  if (groups.length > 1) {
    const mergedByKey = new Map<string, RobotsGroup>();
    const order: string[] = [];
    function toKey(agents: string[]): string {
      return agents
        .map((a) => a.toLowerCase())
        .sort()
        .join("\n");
    }
    function mergeAgents(existing: string[], incoming: string[]): string[] {
      const seen = new Set(existing.map((a) => a.toLowerCase()));
      const out = existing.slice();
      for (const a of incoming) {
        const k = a.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push(a);
        }
      }
      return out;
    }
    for (const g of groups) {
      const key = toKey(g.userAgents);
      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, {
          userAgents: g.userAgents.slice(),
          rules: g.rules.slice(),
        });
        order.push(key);
      } else {
        const existing = mergedByKey.get(key);
        if (!existing) continue;
        existing.userAgents = mergeAgents(existing.userAgents, g.userAgents);
        existing.rules.push(...g.rules);
      }
    }
    const mergedGroups: RobotsGroup[] = order
      .map((k) => mergedByKey.get(k))
      .filter((x): x is RobotsGroup => Boolean(x))
      .map((g) => {
        // Deduplicate identical rules while preserving first occurrence order
        const seen = new Set<string>();
        const dedupedRules: RobotsRule[] = [];
        for (const r of g.rules) {
          const key = `${r.type}\n${r.value}`;
          if (seen.has(key)) continue;
          seen.add(key);
          dedupedRules.push(r);
        }
        return { ...g, rules: dedupedRules };
      });
    return { fetched: true, groups: mergedGroups, sitemaps };
  }

  return { fetched: true, groups, sitemaps };
}
