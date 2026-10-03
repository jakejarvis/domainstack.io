/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { slugify } from "./slugify";

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("collapses multiple non-alphanumeric characters", () => {
    expect(slugify("hello   world")).toBe("hello-world");
    expect(slugify("hello---world")).toBe("hello-world");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles numbers", () => {
    expect(slugify("Hello World 123")).toBe("hello-world-123");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles string with only special characters", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("keeps different non-Latin names apart", () => {
    const a = slugify("阿里云计算有限公司（万网）");
    const b = slugify("北京新网数码信息技术有限公司");
    expect(a).toMatch(/^u-/);
    expect(b).toMatch(/^u-/);
    expect(a).not.toBe(b);
  });

  it("returns the same slug for the same non-Latin name", () => {
    expect(slugify("北京新网数码信息技术有限公司")).toBe(slugify("北京新网数码信息技术有限公司"));
  });

  it("keeps the Latin part and appends a hash for mixed names", () => {
    expect(slugify("广东时代互联 Todaynic")).toMatch(/^todaynic-/);
  });

  it("leaves diacritics that decompose unchanged", () => {
    expect(slugify("München")).toBe("munchen");
  });

  it("hashes letters that do not decompose", () => {
    expect(slugify("Straße")).toMatch(/^stra-e-[a-z0-9]+$/);
  });
});
