/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { detectTechnologies } from "./detect";
import type { TechnologyCatalog, TechnologyEntry } from "./parser";
import type { TechDetectionContext } from "./rules";

const emptyContext: TechDetectionContext = {
  url: "",
  html: "",
  headers: {},
  cookies: {},
  meta: {},
  scriptSrc: [],
  dnsTxt: [],
};

function entry(
  overrides: Partial<TechnologyEntry> & Pick<TechnologyEntry, "slug">,
): TechnologyEntry {
  return {
    name: overrides.slug,
    categories: ["other"],
    website: `https://${overrides.slug}.example.com`,
    rule: { kind: "htmlRegex", pattern: `__never_matches_${overrides.slug}__` },
    ...overrides,
  };
}

describe("detectTechnologies", () => {
  it("returns every matching entry", () => {
    const catalog: TechnologyCatalog = [
      entry({ slug: "a", rule: { kind: "htmlRegex", pattern: "marker-a" } }),
      entry({ slug: "b", rule: { kind: "htmlRegex", pattern: "marker-b" } }),
      entry({ slug: "c" }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a marker-b" };

    const result = detectTechnologies(catalog, ctx);

    expect(result.map((t) => t.slug).sort()).toEqual(["a", "b"]);
  });

  it("adds an implied entry as implied, with no version or signals", () => {
    const catalog: TechnologyCatalog = [
      entry({ slug: "a", implies: ["b"], rule: { kind: "htmlRegex", pattern: "marker-a" } }),
      entry({ slug: "b" }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a" };

    const result = detectTechnologies(catalog, ctx);
    const b = result.find((t) => t.slug === "b");

    expect(b).toBeDefined();
    expect(b?.implied).toBe(true);
    expect(b?.version).toBeNull();
    expect(b?.detectedBy).toEqual([]);
  });

  it("resolves transitive implies (a -> b -> c)", () => {
    const catalog: TechnologyCatalog = [
      entry({ slug: "a", implies: ["b"], rule: { kind: "htmlRegex", pattern: "marker-a" } }),
      entry({ slug: "b", implies: ["c"] }),
      entry({ slug: "c" }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a" };

    const result = detectTechnologies(catalog, ctx);

    expect(result.map((t) => t.slug).sort()).toEqual(["a", "b", "c"]);
    expect(result.find((t) => t.slug === "c")?.implied).toBe(true);
  });

  it("keeps a direct match's implied flag false and version even when also implied", () => {
    const catalog: TechnologyCatalog = [
      entry({
        slug: "a",
        implies: ["b"],
        rule: { kind: "htmlRegex", pattern: "marker-a" },
      }),
      entry({
        slug: "b",
        rule: { kind: "htmlRegex", pattern: "version-([\\d.]+)", version: 1 },
      }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a version-1.0.0" };

    const result = detectTechnologies(catalog, ctx);
    const b = result.find((t) => t.slug === "b");

    expect(b?.implied).toBe(false);
    expect(b?.version).toBe("1.0.0");
  });

  it("removes a slug excluded by another entry's direct match", () => {
    const catalog: TechnologyCatalog = [
      entry({
        slug: "a",
        excludes: ["b"],
        rule: { kind: "htmlRegex", pattern: "marker-a" },
      }),
      entry({ slug: "b", rule: { kind: "htmlRegex", pattern: "marker-b" } }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a marker-b" };

    const result = detectTechnologies(catalog, ctx);

    expect(result.map((t) => t.slug)).toEqual(["a"]);
  });

  it("prevents an excluded slug from arriving via implies", () => {
    const catalog: TechnologyCatalog = [
      entry({
        slug: "a",
        implies: ["c"],
        excludes: ["c"],
        rule: { kind: "htmlRegex", pattern: "marker-a" },
      }),
      entry({ slug: "c" }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a" };

    const result = detectTechnologies(catalog, ctx);

    expect(result.map((t) => t.slug)).toEqual(["a"]);
  });

  it("terminates on an implies cycle without duplicating entries", () => {
    const catalog: TechnologyCatalog = [
      entry({ slug: "a", implies: ["b"], rule: { kind: "htmlRegex", pattern: "marker-a" } }),
      entry({ slug: "b", implies: ["a"] }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker-a" };

    const result = detectTechnologies(catalog, ctx);

    expect(result.map((t) => t.slug).sort()).toEqual(["a", "b"]);
  });

  it("derives iconDomain as the registrable domain of website", () => {
    const catalog: TechnologyCatalog = [
      entry({
        slug: "shopify",
        website: "https://www.shopify.com",
        rule: { kind: "htmlRegex", pattern: "marker" },
      }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker" };

    const result = detectTechnologies(catalog, ctx);

    expect(result[0]?.iconDomain).toBe("shopify.com");
  });

  it("orders direct matches before implied, then alphabetically by name", () => {
    const catalog: TechnologyCatalog = [
      entry({
        slug: "z-direct",
        name: "Zebra",
        implies: ["a-implied", "m-implied"],
        rule: { kind: "htmlRegex", pattern: "marker" },
      }),
      entry({ slug: "a-implied", name: "Alpha" }),
      entry({ slug: "m-implied", name: "Mango" }),
      entry({ slug: "b-direct", name: "Banana", rule: { kind: "htmlRegex", pattern: "marker" } }),
    ];
    const ctx: TechDetectionContext = { ...emptyContext, html: "marker" };

    const result = detectTechnologies(catalog, ctx);

    expect(result.map((t) => t.name)).toEqual(["Banana", "Zebra", "Alpha", "Mango"]);
  });
});
