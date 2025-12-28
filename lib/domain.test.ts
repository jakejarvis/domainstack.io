/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { isValidDomain, normalizeDomainInput } from "./domain";

describe("normalizeDomainInput", () => {
  it("strips scheme, auth, port, path and lowercases", () => {
    expect(
      normalizeDomainInput("https://user:pass@WWW.Example.TEST:8080/a/b?c#d"),
    ).toBe("example.test");
  });

  it("removes trailing dot and leading www", () => {
    expect(normalizeDomainInput("www.example.test.")).toBe("example.test");
  });

  it("handles inputs without scheme via implicit URL parsing", () => {
    expect(normalizeDomainInput("Sub.Example.test/extra")).toBe(
      "sub.example.test",
    );
  });

  it("falls back on invalid URL-with-scheme by manual stripping", () => {
    expect(normalizeDomainInput("fake+scheme://ex-ample.test/path")).toBe(
      "ex-ample.test",
    );
  });

  it("handles malformed protocols (single slash)", () => {
    expect(normalizeDomainInput("http:/example.test")).toBe("example.test");
  });

  it("handles malformed protocols (triple slash)", () => {
    expect(normalizeDomainInput("http:///example.test")).toBe("example.test");
  });

  it("handles malformed protocols (multiple colons)", () => {
    expect(normalizeDomainInput("https:::example.test/path")).toBe(
      "example.test",
    );
  });

  it("rejects IPv6 literals", () => {
    expect(normalizeDomainInput("[::1]")).toBe("");
    expect(normalizeDomainInput("[::1]:8080")).toBe("");
    expect(normalizeDomainInput("http://[2001:db8::1]/path")).toBe("");
  });

  it("handles spaces and whitespace", () => {
    expect(normalizeDomainInput("  example.test  ")).toBe("example.test");
    expect(normalizeDomainInput("example.test /path")).toBe("example.test");
  });

  it("strips www from subdomains", () => {
    expect(normalizeDomainInput("www.example.test")).toBe("example.test");
    expect(normalizeDomainInput("WWW.EXAMPLE.TEST")).toBe("example.test");
  });

  it("preserves non-www subdomains", () => {
    expect(normalizeDomainInput("api.example.test")).toBe("api.example.test");
    expect(normalizeDomainInput("sub.domain.example.test")).toBe(
      "sub.domain.example.test",
    );
  });

  it("handles query parameters and fragments", () => {
    expect(normalizeDomainInput("example.test?query=value")).toBe(
      "example.test",
    );
    expect(normalizeDomainInput("example.test#fragment")).toBe("example.test");
    expect(normalizeDomainInput("example.test?q=1#frag")).toBe("example.test");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDomainInput("")).toBe("");
    expect(normalizeDomainInput("   ")).toBe("");
  });
});

describe("isValidDomain", () => {
  it("accepts typical domains", () => {
    expect(isValidDomain("example.test")).toBe(true);
    expect(isValidDomain("sub.example.test")).toBe(true);
  });

  it("accepts punycoded labels", () => {
    expect(isValidDomain("xn--bcher-kva.example")).toBe(true);
  });

  it("rejects localhost and invalid labels", () => {
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("exa_mple.test")).toBe(false);
    expect(isValidDomain("-badstart.test")).toBe(false);
    expect(isValidDomain("badend-.test")).toBe(false);
  });
});
