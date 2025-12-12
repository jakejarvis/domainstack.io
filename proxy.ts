import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CONSENT_REQUIRED_COOKIE,
  GDPR_COUNTRY_CODES,
} from "@/lib/constants/gdpr";
import { toRegistrableDomain } from "@/lib/domain-server";

// Routes that require authentication (pre-check for faster redirects)
const PROTECTED_ROUTES = ["/dashboard", "/settings"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Determine response type
  let response: NextResponse | undefined;

  // Fast path: root path or empty
  if (pathname.length <= 1) {
    response = NextResponse.next();
  }

  // Special case for OpenGraph images: /example.com/opengraph-image
  // This pattern is used by Next.js OG image generation for the dynamic route [domain]/opengraph-image.tsx
  // We should skip middleware processing for this specific suffix to allow the route to handle it.
  if (pathname.endsWith("/opengraph-image")) {
    response = NextResponse.next();
  }

  // Quick redirect for unauthenticated users trying to access protected routes
  // This is NOT for security - just a faster redirect path before hitting the page
  // The actual security check happens in the page/layout server components
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtectedRoute) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      response = NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ============================================================================
  // Redirect handling for domain reports (e.g. /SUBDOMAIN.EXAMPLE.COM/path -> /example.com)
  // ============================================================================

  if (!response) {
    // 1. Get raw input (remove leading slash)
    const rawInput = pathname.slice(1);
    let decodedInput = rawInput;

    // 2. Decode if possible
    try {
      decodedInput = decodeURIComponent(rawInput);
    } catch {
      // ignore decoding failures
    }

    // 3. Validate and extract the registrable domain
    const registrable = toRegistrableDomain(decodedInput);
    if (!registrable) {
      // Not a valid domain - pass through to Next.js routing
      response = NextResponse.next();
    } else if (decodedInput !== registrable) {
      // 4. Redirect if necessary
      // We compare the originally decoded input against the final canonical domain.
      // Any difference (path, query, scheme, case, whitespace, userinfo, port, subdomain) triggers a redirect.
      const url = request.nextUrl.clone();
      url.pathname = `/${registrable}`;
      url.search = "";
      url.hash = "";
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next();
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
