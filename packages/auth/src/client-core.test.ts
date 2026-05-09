import { describe, expect, it } from "vitest";

import {
  AUTH_SCHEME,
  AUTH_STORAGE_PREFIX,
  getAuthCookieHeader,
  NATIVE_AUTH_PROVIDERS,
  normalizeBaseUrl,
} from "./client-core";

describe("auth client core", () => {
  it("normalizes optional base URLs without inventing a default", () => {
    expect(normalizeBaseUrl(undefined)).toBeUndefined();
    expect(normalizeBaseUrl("")).toBeUndefined();
    expect(normalizeBaseUrl("  https://domainstack.io///  ")).toBe("https://domainstack.io");
  });

  it("adapts native Better Auth cookies into request headers", () => {
    expect(getAuthCookieHeader({ getCookie: () => "" })).toBeNull();
    expect(getAuthCookieHeader({ getCookie: () => null })).toBeNull();
    expect(getAuthCookieHeader({ getCookie: () => "better-auth.session_token=abc" })).toBe(
      "better-auth.session_token=abc",
    );
  });

  it("keeps native auth constants centralized", () => {
    expect(AUTH_SCHEME).toBe("domainstack");
    expect(AUTH_STORAGE_PREFIX).toBe("domainstack");
    expect(NATIVE_AUTH_PROVIDERS).toEqual(["apple", "google", "github"]);
  });
});
