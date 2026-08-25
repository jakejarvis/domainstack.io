import { describe, expect, it } from "vitest";

import { isExpectedDnsError } from "./dns";
import { SafeFetchError } from "./errors";

describe("isExpectedDnsError", () => {
  it("returns false for non-Error values", () => {
    expect(isExpectedDnsError("error")).toBe(false);
    expect(isExpectedDnsError(null)).toBe(false);
  });

  it("detects ENOTFOUND errors", () => {
    const err = new Error("DNS error");
    (err as NodeJS.ErrnoException).code = "ENOTFOUND";
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects ENODATA when A/AAAA records are missing", () => {
    const err = new Error("queryA ENODATA example.com");
    (err as NodeJS.ErrnoException).code = "ENODATA";
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects EAI_AGAIN errors", () => {
    const err = new Error("DNS error");
    (err as NodeJS.ErrnoException).code = "EAI_AGAIN";
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects nested cause codes", () => {
    const err = new Error("fetch failed", {
      cause: Object.assign(new Error("queryA ENODATA example.com"), { code: "ENODATA" }),
    });
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects SafeFetchError dns_error for empty A/AAAA answers", () => {
    const err = new SafeFetchError("dns_error", "DNS lookup returned no records");
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects SafeFetchError wrapping a resolver failure", () => {
    const err = new SafeFetchError("dns_error", "queryA ENODATA example.com");
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("does not treat DNS lookup timeouts as permanent", () => {
    const err = new SafeFetchError("dns_error", "DNS lookup timed out after 25ms");
    expect(isExpectedDnsError(err)).toBe(false);
  });

  it("detects getaddrinfo errors by message", () => {
    expect(isExpectedDnsError(new Error("getaddrinfo ENOTFOUND example.com"))).toBe(true);
  });
});
