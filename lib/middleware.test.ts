/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { getProxyAction } from "./middleware";

describe("getProxyAction", () => {
  it("skips root path", () => {
    expect(getProxyAction("/")).toEqual({ type: "skip" });
  });

  it("matches clean domain", () => {
    expect(getProxyAction("/example.com")).toEqual({ type: "match" });
  });

  it("redirects full URL to domain", () => {
    expect(getProxyAction("/https://example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects dirty path to domain", () => {
    expect(getProxyAction("/example.com/foo")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects query params to domain", () => {
    expect(getProxyAction("/example.com?q=1")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects subdomain to registrable domain", () => {
    expect(getProxyAction("/www.example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("handles user info", () => {
    // "user:pass@example.com" parses to "example.com"
    // Since input != registrable, it redirects to clean domain
    expect(getProxyAction("/user:pass@example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("handles user info in URL", () => {
    expect(getProxyAction("/https://user:pass@example.com/foo")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("skips IPv6 literals", () => {
    expect(getProxyAction("/[::1]")).toEqual({ type: "skip" });
  });

  it("skips IPv6 literals with port", () => {
    expect(getProxyAction("/[::1]:8080")).toEqual({ type: "skip" });
  });

  it("redirects port on valid domain", () => {
    // "example.com:8080" -> "example.com"
    // Input has port, so it redirects to clean domain
    expect(getProxyAction("/example.com:8080")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("skips invalid domains", () => {
    // toRegistrableDomain returns null for "invalid-domain"
    expect(getProxyAction("/invalid-domain")).toEqual({ type: "skip" });
  });

  it("redirects messy input", () => {
    // "/  example.com  " -> "example.com"
    // Input has spaces, so it redirects to clean domain
    expect(getProxyAction("/  example.com  ")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects messy input with encoded spaces", () => {
    // URL encoded space: "/%20example.com%20" -> " example.com " -> "example.com"
    // Decoded input " example.com " != "example.com", so it redirects
    expect(getProxyAction("/%20example.com%20")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects malformed protocol", () => {
    expect(getProxyAction("/http:/example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects malformed protocol 2", () => {
    expect(getProxyAction("/http:///example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });
});
