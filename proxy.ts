import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toRegistrableDomain } from "@/lib/normalize-domain";

// Routes that require authentication (pre-check for faster redirects)
const PROTECTED_ROUTES = ["/dashboard", "/settings"];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Fast path: root path or empty
  if (pathname.length <= 1) {
    // Handle search queries (e.g. /?q=example.com) from homepage or browser search bar
    const query = searchParams.get("q");
    if (query) {
      const registrable = toRegistrableDomain(query);
      if (registrable) {
        const url = request.nextUrl.clone();
        url.pathname = `/${registrable}`;
        url.search = "";
        url.hash = "";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  }

  // Quick redirect for unauthenticated users trying to access protected routes
  // This is NOT for security - just a faster redirect path before hitting the page
  // The actual security check happens in the page/layout server components
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Exempt only the calendar feed route from auth check when token is present
  const isCalendarFeedRoute =
    (pathname === "/dashboard/feed.ics" ||
      pathname === "/dashboard/feed.ics/") &&
    searchParams.get("token");

  if (isProtectedRoute && !isCalendarFeedRoute) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ============================================================================
  // Redirect handling for domain reports (e.g. /SUBDOMAIN.EXAMPLE.COM/path -> /example.com)
  // ============================================================================

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
    return NextResponse.next();
  }

  // 4. Redirect if necessary
  // We compare the originally decoded input against the final canonical domain.
  // Any difference (path, query, scheme, case, whitespace, userinfo, port, subdomain) triggers a redirect.
  if (decodedInput !== registrable) {
    const url = request.nextUrl.clone();
    url.pathname = `/${registrable}`;
    url.search = "";
    url.hash = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude API and Next internals/static assets for performance and to avoid side effects
    // Static files use (?:[?#]|$) to match exactly (not as prefixes) so domains like "favicon.icon.com" are not excluded
    // Also exclude .well-known/* for Vercel Workflow internal paths
    "/((?!api/|_next/|_vercel/|_proxy/|\\.well-known/|(?:favicon.ico|icon.svg|apple-icon.png|robots.txt|manifest.webmanifest|opensearch.xml)(?:[?#]|$)).*)",
  ],
};
