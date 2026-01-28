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
});
