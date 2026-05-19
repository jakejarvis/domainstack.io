import { type NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE, isLocale, negotiateLocale } from "@domainstack/i18n/config";

/**
 * Cookie-only locale negotiation (no URL prefix). If the visitor has no valid
 * `ds_locale` cookie yet, negotiate from `Accept-Language` and persist it so
 * subsequent requests (and RSC) read a stable locale.
 */
export function middleware(req: NextRequest): NextResponse {
  const existing = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existing)) return NextResponse.next();

  const locale = negotiateLocale(req.headers.get("accept-language"));
  const res = NextResponse.next();
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  // Exclude Next internals, the PostHog ingest proxy, API/workflow routes,
  // well-known endpoints, and anything with a file extension (static assets).
  matcher: ["/((?!_next|_proxy|api|\\.well-known|.*\\.).*)"],
};
