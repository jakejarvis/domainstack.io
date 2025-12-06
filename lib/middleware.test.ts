import { describe, expect, it } from "vitest";
import { getMiddlewareRedirectAction } from "./middleware";

describe("getMiddlewareRedirectAction", () => {
  it("skips root path", () => {
    expect(getMiddlewareRedirectAction("/")).toBeNull();
  });

  it("skips opengraph-image route", () => {
    // This is essential for the dynamic OG image route [domain]/opengraph-image.tsx
    expect(
      getMiddlewareRedirectAction("/example.com/opengraph-image"),
    ).toBeNull();

    // Also check nested paths just in case, though our routing is [domain]
    expect(
      getMiddlewareRedirectAction("/https://example.com/opengraph-image"),
    ).toBeNull();
  });

  it("matches clean domain", () => {
    expect(getMiddlewareRedirectAction("/example.com")).toEqual({
      type: "match",
    });
  });

  it("redirects full URL to domain", () => {
    expect(getMiddlewareRedirectAction("/https://example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects dirty path to domain", () => {
    expect(getMiddlewareRedirectAction("/example.com/foo")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects query params to domain", () => {
    expect(getMiddlewareRedirectAction("/example.com?q=1")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects subdomain to registrable domain", () => {
    expect(getMiddlewareRedirectAction("/www.example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("handles user info", () => {
    // "user:pass@example.com" parses to "example.com"
    // Since input != registrable, it redirects to clean domain
    expect(getMiddlewareRedirectAction("/user:pass@example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("handles user info in URL", () => {
    expect(
      getMiddlewareRedirectAction("/https://user:pass@example.com/foo"),
    ).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("skips IPv6 literals", () => {
    expect(getMiddlewareRedirectAction("/[::1]")).toBeNull();
  });

  it("skips IPv6 literals with port", () => {
    expect(getMiddlewareRedirectAction("/[::1]:8080")).toBeNull();
  });

  it("redirects port on valid domain", () => {
    // "example.com:8080" -> "example.com"
    // Input has port, so it redirects to clean domain
    expect(getMiddlewareRedirectAction("/example.com:8080")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("skips invalid domains", () => {
    // toRegistrableDomain returns null for "invalid-domain"
    expect(getMiddlewareRedirectAction("/invalid-domain")).toBeNull();
  });

  it("redirects messy input", () => {
    // "/  example.com  " -> "example.com"
    // Input has spaces, so it redirects to clean domain
    expect(getMiddlewareRedirectAction("/  example.com  ")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects messy input with encoded spaces", () => {
    // URL encoded space: "/%20example.com%20" -> " example.com " -> "example.com"
    // Decoded input " example.com " != "example.com", so it redirects
    expect(getMiddlewareRedirectAction("/%20example.com%20")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects malformed protocol", () => {
    expect(getMiddlewareRedirectAction("/http:/example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });

  it("redirects malformed protocol 2", () => {
    expect(getMiddlewareRedirectAction("/http:///example.com")).toEqual({
      type: "redirect",
      destination: "/example.com",
    });
  });
});
