import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CONSENT_REQUIRED_COOKIE,
  GDPR_COUNTRY_CODES,
} from "@/lib/constants/gdpr";
import { getMiddlewareRedirectAction } from "@/lib/middleware";

export function proxy(request: NextRequest) {
  // Determine response type
  let response: NextResponse | undefined;

  // Quick redirect for unauthenticated users trying to access dashboard
  // This is NOT for security - just a faster redirect path before hitting the page
  // The actual security check happens in the dashboard layout
  const { pathname } = request.nextUrl;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      response = NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ============================================================================
  // Redirect handling for domain reports (e.g. /SUBDOMAIN.EXAMPLE.COM/path -> /example.com)
  // ============================================================================

  if (!response) {
    const action = getMiddlewareRedirectAction(pathname);

    if (action?.type === "redirect") {
      const url = request.nextUrl.clone();
      url.pathname = action.destination;
      url.search = "";
      url.hash = "";
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next();
    }

    if (action?.type) {
      response.headers.set("x-middleware-decision", action.type);
    }
  }

  // ============================================================================
  // Set GDPR consent cookie
  // ============================================================================

  if (!request.cookies.has(CONSENT_REQUIRED_COOKIE)) {
    const country = request.headers.get("x-vercel-ip-country");
    const requiresConsent = country === null || GDPR_COUNTRY_CODES.has(country);
    response.cookies.set(CONSENT_REQUIRED_COOKIE, requiresConsent ? "1" : "0", {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false, // Needs to be readable by client JS
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude API and Next internals/static assets for performance and to avoid side effects
    // Static files use (?:[?#]|$) to match exactly (not as prefixes) so domains like "favicon.icon.com" are not excluded
    "/((?!api/|_next/|_vercel/|_proxy/|(?:favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|opensearch.xml)(?:[?#]|$)).*)",
  ],
};
