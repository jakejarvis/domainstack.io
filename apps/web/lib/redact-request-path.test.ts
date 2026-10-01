import { describe, expect, it } from "vitest";

import { redactRequestPath } from "./redact-request-path";

describe("redactRequestPath", () => {
  it("replaces the value of a single parameter", () => {
    expect(redactRequestPath("/dashboard/feed.ics?token=abc")).toBe("/dashboard/feed.ics?token=…");
  });

  it("replaces every parameter value and keeps the names", () => {
    expect(redactRequestPath("/api/calendar/user?token=abc&x=1")).toBe(
      "/api/calendar/user?token=…&x=…",
    );
  });

  it("leaves paths without a query string unchanged", () => {
    expect(redactRequestPath("/example.com")).toBe("/example.com");
  });

  it("reduces an absolute URL to its pathname and parameter names", () => {
    expect(redactRequestPath("https://domainstack.io/a?b=c")).toBe("/a?b=…");
  });

  it("lists a repeated parameter name once", () => {
    expect(redactRequestPath("/a?t=1&t=2")).toBe("/a?t=…");
  });

  it("returns a bare pathname for a wildcard path", () => {
    expect(redactRequestPath("*")).toBe("/*");
  });

  it("never contains the credential value", () => {
    expect(redactRequestPath("/dashboard/feed.ics?token=abc")).not.toContain("abc");
    expect(redactRequestPath("/api/calendar/user?token=abc&x=1")).not.toContain("abc");
  });
});
