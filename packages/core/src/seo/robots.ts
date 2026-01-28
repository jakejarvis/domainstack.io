/**
 * Robots.txt parsing utilities.
 */

import type { RobotsGroup, RobotsRule, RobotsTxt } from "@domainstack/types";
import { sanitizeText } from "./utils";

export interface ParseRobotsTxtOptions {
  /** Base URL for resolving relative sitemap URLs */
  baseUrl?: string;
  /** Maximum bytes to process (default: 500KB, aligned with Google's limit) */
  sizeCapBytes?: number;
}

/**
 * Parse a robots.txt file into structured data.
 *
 * Handles:
 * - Multiple User-agent groups
 * - Allow, Disallow, Crawl-Delay, Content-Signal directives
 * - Sitemap declarations (global, not scoped to groups)
 * - Case-insensitive directive names
 * - Comments (# style)
 * - Merging duplicate user-agent groups
 * - Deduplicating identical rules
 *
 * @param text - Raw robots.txt content
 * @param opts - Parsing options
 * @returns Structured robots.txt data
 */
export function parseRobotsTxt(
  text: string,
  opts?: ParseRobotsTxtOptions,
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
