import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@domainstack/auth/server", () => ({
  getSessionCookie: vi.fn<() => string | null>(() => null),
}));

const { proxy } = await import("./proxy");

function run(path: string) {
  return proxy(new NextRequest(new URL(path, "https://domainstack.io")));
}

function redirectPath(path: string): string | null {
  const location = run(path).headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy domain report canonicalization", () => {
  it.each(["/api.example.com", "/www.example.com", "/foo.example.co.uk", "/example.com"])(
    "leaves the canonical hostname %s alone",
    (path) => {
      expect(redirectPath(path)).toBeNull();
    },
  );

  it("canonicalizes casing without dropping labels", () => {
    expect(redirectPath("/API.Example.COM")).toBe("/api.example.com");
    expect(redirectPath("/WWW.Example.com")).toBe("/www.example.com");
  });

  it("strips a trailing dot", () => {
    expect(redirectPath("/api.example.com.")).toBe("/api.example.com");
  });

  it("redirects search queries to the exact hostname", () => {
    expect(redirectPath("/?q=https://www.example.com/path")).toBe("/www.example.com");
    expect(redirectPath("/?q=api.example.com")).toBe("/api.example.com");
  });

  it("passes non-domain paths through", () => {
    expect(redirectPath("/about")).toBeNull();
    expect(redirectPath("/co.uk")).toBeNull();
  });
});
