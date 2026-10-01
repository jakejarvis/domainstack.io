import { describe, expect, it } from "vitest";

import { BLACKLISTED_SUFFIXES } from "@domainstack/constants";

import { toRegistrableDomain } from "./index";

describe("toRegistrableDomain", () => {
  it("strips www", () => {
    expect(toRegistrableDomain("www.example.com")).toBe("example.com");
  });

  it("extracts eTLD+1 from a URL on a multi-label public suffix", () => {
    expect(toRegistrableDomain("https://blog.example.co.uk/path")).toBe("example.co.uk");
  });

  it("collapses nameserver hostnames to their registrable domain", () => {
    expect(toRegistrableDomain("ns1.cloudflare.com")).toBe("cloudflare.com");
  });

  it("lowercases and drops the trailing dot", () => {
    expect(toRegistrableDomain("EXAMPLE.COM.")).toBe("example.com");
  });

  it("returns the punycode form for a Unicode IDN under a real public suffix", () => {
    expect(toRegistrableDomain("bücher.de")).toBe("xn--bcher-kva.de");
    expect(toRegistrableDomain("www.bücher.de")).toBe("xn--bcher-kva.de");
  });

  it("returns null for a Unicode IDN under a non-public suffix", () => {
    expect(toRegistrableDomain("bücher.example")).toBeNull();
  });

  it("returns null for a blacklisted suffix", () => {
    expect(toRegistrableDomain(`foo${BLACKLISTED_SUFFIXES[0]}`)).toBeNull();
  });

  it.each(["localhost", "", "   "])("returns null for %j", (input) => {
    expect(toRegistrableDomain(input)).toBeNull();
  });

  it("returns null for a bare public suffix", () => {
    expect(toRegistrableDomain("co.uk")).toBeNull();
  });
});
