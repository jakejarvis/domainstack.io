import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleProxyRequest } from "@/lib/middleware";

export function proxy(request: NextRequest) {
  // Quick redirect for unauthenticated users trying to access dashboard
  // This is NOT for security - just a faster redirect path before hitting the page
  // The actual security check happens in the dashboard layout
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return handleProxyRequest(request);
}

export const config = {
  matcher: [
    // Exclude API and Next internals/static assets for performance and to avoid side effects
    // Static files use (?:[?#]|$) to match exactly (not as prefixes) so domains like "favicon.icon.com" are not excluded
    "/((?!api/|_next/|_vercel/|_proxy/|(?:favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|opensearch.xml)(?:[?#]|$)).*)",
  ],
};
