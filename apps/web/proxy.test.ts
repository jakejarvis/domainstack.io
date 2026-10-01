import {
  getRedirectUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

const ORIGIN = "https://domainstack.io";
// Better Auth's default session cookie (`getSessionCookie` also accepts a `__Secure-` prefix on HTTPS).
const SESSION_COOKIE = "better-auth.session_token=v";

function request(path: string, { signedIn = false }: { signedIn?: boolean } = {}) {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: signedIn ? { cookie: SESSION_COOKIE } : undefined,
  });
}

describe("proxy matcher", () => {
  it.each([
    { url: "/", matches: true },
    { url: "/example.com", matches: true },
    { url: "/dashboard", matches: true },
    { url: "/dashboard/feed.ics?token=x", matches: true },
    { url: "/api/trpc/domain.getRegistration", matches: false },
    { url: "/_next/static/chunks/a.js", matches: false },
    { url: "/.well-known/workflow/v1/flow", matches: false },
    { url: "/favicon.ico", matches: false },
    { url: "/robots.txt", matches: false },
    // a domain that merely starts like a static file name
    { url: "/favicon.icon.com", matches: true },
  ])("$url -> $matches", ({ url, matches }) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(matches);
  });
});

describe("proxy", () => {
  it("redirects a homepage search to the registrable domain's report", () => {
    const res = proxy(request("/?q=https://www.Example.com/x"));
    expect(getRedirectUrl(res)).toBe(`${ORIGIN}/example.com`);
  });

  it("does not redirect a homepage search that is not a domain", () => {
    const res = proxy(request("/?q=not a domain"));
    expect(getRedirectUrl(res)).toBeNull();
  });

  it("redirects signed-out /dashboard to login with next", () => {
    const res = proxy(request("/dashboard"));
    expect(getRedirectUrl(res)).toBe(`${ORIGIN}/login?next=%2Fdashboard`);
  });

  it("keeps the nested path and query in next for signed-out /settings", () => {
    const location = getRedirectUrl(proxy(request("/settings/account?tab=x")));
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/settings/account?tab=x");
  });

  it("lets a signed-in user through to /dashboard", () => {
    const res = proxy(request("/dashboard", { signedIn: true }));
    expect(getRedirectUrl(res)).toBeNull();
  });

  it("exempts the calendar feed when a token is present", () => {
    const res = proxy(request("/dashboard/feed.ics?token=abc"));
    expect(getRedirectUrl(res)).toBeNull();
  });

  it("still protects the calendar feed path without a token", () => {
    const res = proxy(request("/dashboard/feed.ics"));
    expect(getRedirectUrl(res)).toContain("/login");
  });

  it("canonicalizes a report URL to its registrable domain", () => {
    const res = proxy(request("/WWW.EXAMPLE.COM/path"));
    expect(getRedirectUrl(res)).toBe(`${ORIGIN}/example.com`);
  });

  it("passes an already canonical report URL through", () => {
    const res = proxy(request("/example.com"));
    expect(getRedirectUrl(res)).toBeNull();
    expect(isRewrite(res)).toBe(false);
  });

  it("passes non-domain paths through", () => {
    expect(getRedirectUrl(proxy(request("/help")))).toBeNull();
  });

  it("passes blacklisted-suffix paths through", () => {
    expect(getRedirectUrl(proxy(request("/foo.css.map")))).toBeNull();
  });
});
