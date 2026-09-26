import { describe, expect, it } from "vitest";

import { isValidDomain, normalizeDomainInput, normalizeHostnameInput } from "./client";

describe("normalizeDomainInput", () => {
  it("strips scheme, auth, port, path and lowercases", () => {
    expect(normalizeDomainInput("https://user:pass@WWW.Example.TEST:8080/a/b?c#d")).toBe(
      "example.test",
    );
  });

  it("removes trailing dot and leading www", () => {
    expect(normalizeDomainInput("www.example.test.")).toBe("example.test");
  });

  it("handles inputs without scheme via implicit URL parsing", () => {
    expect(normalizeDomainInput("Sub.Example.test/extra")).toBe("sub.example.test");
  });

  it("falls back on invalid URL-with-scheme by manual stripping", () => {
    expect(normalizeDomainInput("fake+scheme://ex-ample.test/path")).toBe("ex-ample.test");
  });

  it("handles malformed protocols (single slash)", () => {
    expect(normalizeDomainInput("http:/example.test")).toBe("example.test");
  });

  it("handles malformed protocols (triple slash)", () => {
    expect(normalizeDomainInput("http:///example.test")).toBe("example.test");
  });

  it("handles malformed protocols (multiple colons)", () => {
    expect(normalizeDomainInput("https:::example.test/path")).toBe("example.test");
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
    expect(normalizeDomainInput("sub.domain.example.test")).toBe("sub.domain.example.test");
  });

  it("handles query parameters and fragments", () => {
    expect(normalizeDomainInput("example.test?query=value")).toBe("example.test");
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

describe("normalizeDomainInput IDN handling", () => {
  it("punycodes an IDN whether or not a scheme was typed", () => {
    const expected = "xn--mnchen-3ya.de";
    expect(normalizeDomainInput("münchen.de")).toBe(expected);
    expect(normalizeDomainInput("https://münchen.de")).toBe(expected);
    expect(normalizeDomainInput("http://münchen.de/path?q=1")).toBe(expected);
    expect(normalizeDomainInput("MÜNCHEN.DE")).toBe(expected);
  });

  it("produces a value isValidDomain accepts either way", () => {
    expect(isValidDomain(normalizeDomainInput("https://münchen.de"))).toBe(true);
    expect(isValidDomain(normalizeDomainInput("münchen.de"))).toBe(true);
  });
});

describe("normalizeHostnameInput", () => {
  it("keeps www and every other label", () => {
    expect(normalizeHostnameInput("www.example.test")).toBe("www.example.test");
    expect(normalizeHostnameInput("WWW.EXAMPLE.TEST")).toBe("www.example.test");
    expect(normalizeHostnameInput("api.foo.example.test")).toBe("api.foo.example.test");
  });

  it("applies the same cleanup as normalizeDomainInput", () => {
    expect(normalizeHostnameInput("https://user:pass@WWW.Example.TEST:8080/a/b?c#d")).toBe(
      "www.example.test",
    );
    expect(normalizeHostnameInput("Api.Example.test.")).toBe("api.example.test");
    expect(normalizeHostnameInput("http:/api.example.test")).toBe("api.example.test");
    expect(normalizeHostnameInput("  api.example.test/path  ")).toBe("api.example.test");
    expect(normalizeHostnameInput("[::1]:8080")).toBe("");
    expect(normalizeHostnameInput("")).toBe("");
  });

  it("punycodes IDN labels", () => {
    expect(normalizeHostnameInput("www.münchen.de")).toBe("www.xn--mnchen-3ya.de");
  });
});
