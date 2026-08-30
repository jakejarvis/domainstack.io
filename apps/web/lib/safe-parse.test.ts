import { describe, expect, it } from "vitest";

import { safeDecodeURIComponent, safeUrl } from "./safe-parse";

describe("safeDecodeURIComponent", () => {
  it("decodes a valid percent-encoded value", () => {
    expect(safeDecodeURIComponent("example.com")).toBe("example.com");
    expect(safeDecodeURIComponent("foo%2Fbar")).toBe("foo/bar");
  });

  it("returns undefined for malformed percent-escapes", () => {
    expect(safeDecodeURIComponent("%")).toBeUndefined();
    expect(safeDecodeURIComponent("100%off")).toBeUndefined();
    expect(safeDecodeURIComponent("%E0%A4%A")).toBeUndefined();
  });
});

describe("safeUrl", () => {
  it("parses a valid absolute URL", () => {
    expect(safeUrl("https://domainstack.io")?.href).toBe("https://domainstack.io/");
  });

  it("returns undefined for invalid input", () => {
    expect(safeUrl("not a url")).toBeUndefined();
    expect(safeUrl("")).toBeUndefined();
  });
});
