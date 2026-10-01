import { describe, expect, it } from "vitest";

import { loginHref, safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each(["/example.com", "/dashboard/add-domain?domain=a.com", "/settings#x"])(
    "accepts %s",
    (value) => {
      expect(safeNextPath(value)).toBe(value);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "/login",
    "/login?next=/x",
    "/login/foo",
    "/api/trpc",
    // Dot-segments that normalize to a protocol-relative URL
    "/.//evil.com",
    "/a/..//evil.com",
    "/%2e//evil.com",
    "/./\\evil.com",
    "/.\\\\evil.com",
  ])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("normalizes dot segments", () => {
    expect(safeNextPath("/a/../b")).toBe("/b");
  });

  it.each(["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\t\\evil.com"])(
    "never resolves control-character value %j to another origin",
    (value) => {
      const result = safeNextPath(value);
      if (result !== null) {
        expect(result.startsWith("/")).toBe(true);
        expect(result.startsWith("//")).toBe(false);
        expect(new URL(result, "https://placeholder.invalid").origin).toBe(
          "https://placeholder.invalid",
        );
      }
    },
  );
});

describe("loginHref", () => {
  it("maps the root to plain /login", () => {
    expect(loginHref("/")).toBe("/login");
  });

  it("encodes a same-origin path as next", () => {
    expect(loginHref("/x.com")).toBe("/login?next=%2Fx.com");
  });

  it("falls back to /login for unusable paths", () => {
    expect(loginHref(null)).toBe("/login");
    expect(loginHref("https://evil.com")).toBe("/login");
    expect(loginHref("/login")).toBe("/login");
    expect(loginHref("/.//evil.com")).toBe("/login");
  });
});
