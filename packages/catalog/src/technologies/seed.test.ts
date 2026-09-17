/* @vitest-environment node */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { detectTechnologies } from "./detect";
import { TechnologyCatalogSchema } from "./parser";
import type { TechDetectionContext } from "./rules";

const seed: unknown = JSON.parse(
  readFileSync(new URL("../../seed/technology-catalog.json", import.meta.url), "utf-8"),
);

const emptyContext: TechDetectionContext = {
  url: "",
  html: "",
  headers: {},
  cookies: {},
  meta: {},
  scriptSrc: [],
  dnsTxt: [],
};

describe("seed technology catalog", () => {
  it("passes schema validation", () => {
    const result = TechnologyCatalogSchema.safeParse(seed);

    if (!result.success) {
      // Surface the Zod issues in the assertion message so the author sees
      // which entry is wrong, rather than just "expected true, got false".
      throw new Error(
        `seed catalog failed validation:\n${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }

    expect(result.success).toBe(true);
  });

  it("is non-empty with unique slugs", () => {
    const parsed = TechnologyCatalogSchema.parse(seed);

    expect(parsed.length).toBeGreaterThan(0);
    expect(new Set(parsed.map((e) => e.slug)).size).toBe(parsed.length);
  });

  it("has a valid, registrable website for every entry", () => {
    const parsed = TechnologyCatalogSchema.parse(seed);

    for (const entry of parsed) {
      expect(() => new URL(entry.website)).not.toThrow();

      // iconDomain is derived independently of whether the rule matched, so
      // force a match (an empty "all" always matches) to read it back.
      const alwaysMatches = { ...entry, rule: { all: [] as never[] } };
      const detected = detectTechnologies([alwaysMatches], emptyContext);
      expect(detected[0]?.iconDomain).not.toBeNull();
    }
  });

  it("completes within a generous time budget against a large HTML body (ReDoS guard)", () => {
    // Not a performance benchmark - this guards against a catastrophically
    // backtracking pattern blowing the request budget in production. The
    // fetcher caps HTML at 512 KB (packages/core/src/services/seo.ts).
    const chunk =
      '<div class="card"><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p></div>\n';
    const targetBytes = 512 * 1024;
    const repeats = Math.ceil(targetBytes / chunk.length);
    const html = chunk.repeat(repeats);

    const parsed = TechnologyCatalogSchema.parse(seed);
    const ctx: TechDetectionContext = { ...emptyContext, html };

    const start = performance.now();
    detectTechnologies(parsed, ctx);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it("has no false positives on a plain page", () => {
    const parsed = TechnologyCatalogSchema.parse(seed);
    const ctx: TechDetectionContext = {
      ...emptyContext,
      url: "https://example.com/",
      html: "<html><head><title>t</title></head><body><p>hi</p></body></html>",
    };

    const result = detectTechnologies(parsed, ctx);

    expect(result).toEqual([]);
  });
});
