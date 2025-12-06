import type { NextRequest, NextResponse } from "next/server";
import {
  CONSENT_REQUIRED_COOKIE,
  GDPR_COUNTRY_CODES,
} from "@/lib/constants/gdpr";
import { toRegistrableDomain } from "@/lib/domain-server";

/**
 * Set GDPR consent requirement cookie based on Vercel's geolocation header.
 * Only sets if the cookie doesn't already exist.
 * Returns the response for chaining.
 */
export function setConsentCookieIfNeeded(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (request.cookies.has(CONSENT_REQUIRED_COOKIE)) return response;

  const country = request.headers.get("x-vercel-ip-country") ?? "";
  const requiresConsent = GDPR_COUNTRY_CODES.has(country);

  response.cookies.set(CONSENT_REQUIRED_COOKIE, requiresConsent ? "1" : "0", {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // Needs to be readable by client JS
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export type MiddlewareRedirectAction =
  | { type: "match" }
  | { type: "redirect"; destination: string }
  | null;

/**
 * Pure function to decide the proxy action based on the URL path.
 * Decoupled from NextRequest/NextResponse for easier testing.
 * Returns null to skip processing (e.g. invalid domains, root path, etc).
 */
export function getMiddlewareRedirectAction(
  path: string,
): MiddlewareRedirectAction {
  // Fast path: root path or empty
  if (path.length <= 1) {
    return null;
  }

  // Special case for OpenGraph images: /example.com/opengraph-image
  // This pattern is used by Next.js OG image generation for the dynamic route [domain]/opengraph-image.tsx
  // We should skip middleware processing for this specific suffix to allow the route to handle it.
  if (path.endsWith("/opengraph-image")) {
    return null;
  }

  // 1. Get raw input (remove leading slash)
  const rawInput = path.slice(1);
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
    return null;
  }

  // 4. Redirect if necessary
  // We compare the originally decoded input against the final canonical domain.
  // Any difference (path, query, scheme, case, whitespace, userinfo, port, subdomain) triggers a redirect.
  if (decodedInput !== registrable) {
    return {
      type: "redirect",
      destination: `/${encodeURIComponent(registrable)}`,
    };
  }

  return { type: "match" };
}
