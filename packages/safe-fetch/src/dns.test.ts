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

  it("treats EAI_AGAIN as retryable, not permanent", () => {
    const err = new Error("DNS error");
    (err as NodeJS.ErrnoException).code = "EAI_AGAIN";
    expect(isExpectedDnsError(err)).toBe(false);
  });

  it("treats a nested EAI_AGAIN as retryable", () => {
    const err = new Error("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo EAI_AGAIN example.com"), { code: "EAI_AGAIN" }),
    });
    expect(isExpectedDnsError(err)).toBe(false);
  });

  // resolvePublicHost wraps the resolver's error, keeping it as the cause
  const wrapped = (code: string) => {
    const cause = Object.assign(new Error(`getaddrinfo ${code} example.com`), { code });
    return new SafeFetchError("dns_error", cause.message, undefined, { cause });
  };

  it.each(["EAI_AGAIN", "EAI_FAIL", "ETIMEDOUT", "ESERVFAIL"])(
    "treats a wrapped %s as retryable, since only known-permanent codes are permanent",
    (code) => {
      expect(isExpectedDnsError(wrapped(code))).toBe(false);
    },
  );

  it.each(["ENOTFOUND", "ENODATA", "ENOENT"])("treats a wrapped %s as permanent", (code) => {
    expect(isExpectedDnsError(wrapped(code))).toBe(true);
  });

  it("falls back to the message when there is no errno code", () => {
    expect(
      isExpectedDnsError(new SafeFetchError("dns_error", "getaddrinfo EAI_AGAIN example.com")),
    ).toBe(false);
    expect(
      isExpectedDnsError(new SafeFetchError("dns_error", "getaddrinfo ENOTFOUND example.com")),
    ).toBe(true);
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

  it.each([
    ["an unrecognized message", new SafeFetchError("dns_error", "resolver exploded")],
    [
      "a getaddrinfo failure that is not a permanent code",
      new Error("getaddrinfo EAI_FAIL example.com"),
    ],
    [
      "a wrapped failure with no errno and an unrecognized message",
      new SafeFetchError("dns_error", "getaddrinfo EAI_FAIL example.com"),
    ],
  ])("does not treat %s as permanent", (_label, err) => {
    expect(isExpectedDnsError(err)).toBe(false);
  });

  it("does not let a hostname that looks like a code turn a timeout permanent", () => {
    const err = new SafeFetchError("dns_error", "DNS lookup timed out for enoent.example.com");
    expect(isExpectedDnsError(err)).toBe(false);
  });

  it("does not treat DNS lookup timeouts as permanent", () => {
    const err = new SafeFetchError("dns_error", "DNS lookup timed out after 25ms");
    expect(isExpectedDnsError(err)).toBe(false);
  });

  it("does not treat a plain DNS timeout message as permanent", () => {
    // The message mentions DNS but describes a transient failure, so a
    // substring match on "dns" would wrongly mark it permanent.
    expect(isExpectedDnsError(new Error("DNS query timed out"))).toBe(false);
  });

  it("detects getaddrinfo errors by message", () => {
    expect(isExpectedDnsError(new Error("getaddrinfo ENOTFOUND example.com"))).toBe(true);
  });
});
