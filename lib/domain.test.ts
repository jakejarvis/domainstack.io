/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { isValidDomain, normalizeDomainInput } from "./domain";

describe("normalizeDomainInput", () => {
  it("strips scheme, auth, port, path and lowercases", () => {
    expect(
      normalizeDomainInput("https://user:pass@WWW.Example.COM:8080/a/b?c#d"),
    ).toBe("example.com");
  });

  it("removes trailing dot and leading www", () => {
    expect(normalizeDomainInput("www.example.com.")).toBe("example.com");
  });

  it("handles inputs without scheme via implicit URL parsing", () => {
    expect(normalizeDomainInput("Sub.Example.com/extra")).toBe(
      "sub.example.com",
    );
  });

  it("falls back on invalid URL-with-scheme by manual stripping", () => {
    expect(normalizeDomainInput("fake+scheme://ex-ample.com/path")).toBe(
      "ex-ample.com",
    );
  });

  it("handles malformed protocols (single slash)", () => {
    expect(normalizeDomainInput("http:/example.com")).toBe("example.com");
  });

  it("handles malformed protocols (triple slash)", () => {
    expect(normalizeDomainInput("http:///example.com")).toBe("example.com");
  });

  it("handles malformed protocols (multiple colons)", () => {
    expect(normalizeDomainInput("https:::example.com/path")).toBe(
      "example.com",
    );
  });

  it("rejects IPv6 literals", () => {
    expect(normalizeDomainInput("[::1]")).toBe("");
    expect(normalizeDomainInput("[::1]:8080")).toBe("");
    expect(normalizeDomainInput("http://[2001:db8::1]/path")).toBe("");
  });

  it("handles spaces and whitespace", () => {
    expect(normalizeDomainInput("  example.com  ")).toBe("example.com");
    expect(normalizeDomainInput("example.com /path")).toBe("example.com");
  });

  it("strips www from subdomains", () => {
    expect(normalizeDomainInput("www.example.com")).toBe("example.com");
    expect(normalizeDomainInput("WWW.EXAMPLE.COM")).toBe("example.com");
  });

  it("preserves non-www subdomains", () => {
    expect(normalizeDomainInput("api.example.com")).toBe("api.example.com");
    expect(normalizeDomainInput("sub.domain.example.com")).toBe(
      "sub.domain.example.com",
    );
  });

  it("handles query parameters and fragments", () => {
    expect(normalizeDomainInput("example.com?query=value")).toBe("example.com");
    expect(normalizeDomainInput("example.com#fragment")).toBe("example.com");
    expect(normalizeDomainInput("example.com?q=1#frag")).toBe("example.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDomainInput("")).toBe("");
    expect(normalizeDomainInput("   ")).toBe("");
  });
});

describe("isValidDomain", () => {
  it("accepts typical domains", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("sub.example.co.uk")).toBe(true);
  });

  it("accepts punycoded labels", () => {
    expect(isValidDomain("xn--bcher-kva.example")).toBe(true);
  });

  it("rejects localhost and invalid labels", () => {
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("exa_mple.com")).toBe(false);
    expect(isValidDomain("-badstart.com")).toBe(false);
    expect(isValidDomain("badend-.com")).toBe(false);
  });
});
