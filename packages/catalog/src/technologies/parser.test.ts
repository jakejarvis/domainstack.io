/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { TechnologyCatalogSchema } from "./parser";

function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    slug: "widget",
    name: "Widget",
    categories: ["other"],
    website: "https://widget.example.com",
    rule: { kind: "htmlRegex", pattern: "widget" },
    ...overrides,
  };
}

describe("TechnologyCatalogSchema", () => {
  it("parses a valid minimal catalog", () => {
    const result = TechnologyCatalogSchema.safeParse([baseEntry()]);
    expect(result.success).toBe(true);
  });

  it("rejects an uncompilable regex pattern and names the offending slug", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ slug: "bad-regex", rule: { kind: "htmlRegex", pattern: "[invalid(" } }),
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => i.message.includes("bad-regex"))).toBe(true);
    expect(result.error.issues.some((i) => /Invalid regex pattern/.test(i.message))).toBe(true);
  });

  it("rejects a version index above the pattern's capture group count", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ rule: { kind: "htmlRegex", pattern: "v([\\d.]+)", version: 2 } }),
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => /version index/.test(i.message))).toBe(true);
  });

  it("rejects version: 0", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ rule: { kind: "htmlRegex", pattern: "v([\\d.]+)", version: 0 } }),
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => /version index/.test(i.message))).toBe(true);
  });

  it("accepts a version index that matches the pattern's capture group count", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ rule: { kind: "htmlRegex", pattern: "v([\\d.]+)", version: 1 } }),
    ]);

    expect(result.success).toBe(true);
  });

  it("rejects a duplicate slug", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ slug: "dup" }),
      baseEntry({ slug: "dup", website: "https://other.example.com" }),
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => /duplicate slug/.test(i.message))).toBe(true);
  });

  it("rejects an implies target that does not exist in the catalog", () => {
    const result = TechnologyCatalogSchema.safeParse([baseEntry({ implies: ["nonexistent"] })]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => /unknown slug/.test(i.message))).toBe(true);
  });

  it("rejects an excludes target that does not exist in the catalog", () => {
    const result = TechnologyCatalogSchema.safeParse([baseEntry({ excludes: ["nonexistent"] })]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => /unknown slug/.test(i.message))).toBe(true);
  });

  it("rejects an implies cycle", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ slug: "a", implies: ["b"] }),
      baseEntry({ slug: "b", implies: ["a"] }),
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.issues.some((i) => /implies cycle/.test(i.message))).toBe(true);
  });

  it("rejects a non-kebab-case slug", () => {
    const result = TechnologyCatalogSchema.safeParse([baseEntry({ slug: "Not_Kebab" })]);

    expect(result.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const result = TechnologyCatalogSchema.safeParse([
      baseEntry({ categories: ["not-a-category"] }),
    ]);

    expect(result.success).toBe(false);
  });

  it("rejects a non-URL website", () => {
    const result = TechnologyCatalogSchema.safeParse([baseEntry({ website: "not-a-url" })]);

    expect(result.success).toBe(false);
  });
});
