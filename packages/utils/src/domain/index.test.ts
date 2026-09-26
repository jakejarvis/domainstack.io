import { describe, expect, it } from "vitest";

import { parseDomainTarget, toRegistrableDomain } from "./index";

describe("parseDomainTarget", () => {
  it("parses a registrable domain", () => {
    expect(parseDomainTarget("example.com")).toEqual({
      hostname: "example.com",
      registrableDomain: "example.com",
      isSubdomain: false,
    });
  });

  it("keeps www as its own hostname", () => {
    expect(parseDomainTarget("www.example.com")).toEqual({
      hostname: "www.example.com",
      registrableDomain: "example.com",
      isSubdomain: true,
    });
  });

  it("keeps every subdomain label", () => {
    expect(parseDomainTarget("api.example.com")).toEqual({
      hostname: "api.example.com",
      registrableDomain: "example.com",
      isSubdomain: true,
    });
    expect(parseDomainTarget("api.foo.example.com")).toEqual({
      hostname: "api.foo.example.com",
      registrableDomain: "example.com",
      isSubdomain: true,
    });
  });

  it("uses the public suffix list for multi-part suffixes", () => {
    expect(parseDomainTarget("foo.example.co.uk")).toEqual({
      hostname: "foo.example.co.uk",
      registrableDomain: "example.co.uk",
      isSubdomain: true,
    });
  });

  it("normalizes case, trailing dots, and URLs without dropping labels", () => {
    expect(parseDomainTarget("API.Example.COM.")?.hostname).toBe("api.example.com");
    expect(parseDomainTarget("https://user@WWW.example.com:8443/a?b#c")).toEqual({
      hostname: "www.example.com",
      registrableDomain: "example.com",
      isSubdomain: true,
    });
  });

  it("rejects invalid input", () => {
    expect(parseDomainTarget("")).toBeNull();
    expect(parseDomainTarget("not a domain")).toBeNull();
    expect(parseDomainTarget("localhost")).toBeNull();
    expect(parseDomainTarget("[::1]")).toBeNull();
    expect(parseDomainTarget("co.uk")).toBeNull();
    expect(parseDomainTarget("exa_mple.example.com")).toBeNull();
    expect(parseDomainTarget("-bad.example.com")).toBeNull();
  });

  it("rejects blacklisted suffixes", () => {
    expect(parseDomainTarget("bundle.css.map")).toBeNull();
    expect(parseDomainTarget("app.bundle.css.map")).toBeNull();
  });
});

describe("toRegistrableDomain", () => {
  it("still collapses subdomains and www to the registrable domain", () => {
    expect(toRegistrableDomain("www.example.com")).toBe("example.com");
    expect(toRegistrableDomain("https://api.foo.example.co.uk/x")).toBe("example.co.uk");
  });
});
