import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getMiddlewareRedirectAction,
  setConsentCookieIfNeeded,
} from "@/lib/middleware";

export function proxy(request: NextRequest) {
  // Quick redirect for unauthenticated users trying to access dashboard
  // This is NOT for security - just a faster redirect path before hitting the page
  // The actual security check happens in the dashboard layout
  const { pathname } = request.nextUrl;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return setConsentCookieIfNeeded(
        request,
        NextResponse.redirect(new URL("/login", request.url)),
      );
    }
  }

  // Handle domain report redirects (e.g. /EXAMPLE.COM -> /example.com)
  const action = getMiddlewareRedirectAction(pathname);

  if (action?.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = action.destination;
    url.search = "";
    url.hash = "";
    return setConsentCookieIfNeeded(
      request,
      NextResponse.redirect(url, {
        headers: { "x-middleware-decision": "redirect" },
      }),
    );
  }

  return setConsentCookieIfNeeded(
    request,
    NextResponse.next({
      headers: { "x-middleware-decision": action?.type ?? "next" },
    }),
  );
}

export const config = {
  matcher: [
    // Exclude API and Next internals/static assets for performance and to avoid side effects
    // Static files use (?:[?#]|$) to match exactly (not as prefixes) so domains like "favicon.icon.com" are not excluded
    "/((?!api/|_next/|_vercel/|_proxy/|(?:favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|opensearch.xml)(?:[?#]|$)).*)",
  ],
};
