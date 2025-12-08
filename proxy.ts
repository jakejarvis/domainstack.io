import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CONSENT_REQUIRED_COOKIE,
  GDPR_COUNTRY_CODES,
} from "@/lib/constants/gdpr";
import {
  CORRELATION_ID_COOKIE,
  CORRELATION_ID_HEADER,
  generateCorrelationId,
} from "@/lib/logger/correlation";
import { getMiddlewareRedirectAction } from "@/lib/middleware";

export function proxy(request: NextRequest) {
  // Standard approach: Extract correlation ID from request header or generate new one
  // Use x-request-id (industry standard: AWS, nginx, Heroku)
  const correlationId =
    request.headers.get(CORRELATION_ID_HEADER) || generateCorrelationId();

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

    response.headers.set("x-middleware-decision", action?.type ?? "skip");
  }

  // ============================================================================
  // Set correlation ID header and cookie
  // ============================================================================

  // Set header (for server-side reading and client fetch requests)
  response.headers.set(CORRELATION_ID_HEADER, correlationId);

  // Set cookie (for client-side logger to maintain correlation across page loads)
  response.cookies.set(CORRELATION_ID_COOKIE, correlationId, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: false, // Client needs to read it for logging
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

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
