import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toRegistrableDomain } from "@/lib/domain-server";

export type ProxyAction =
  | { type: "match" }
  | { type: "redirect"; destination: string }
  | null;

/**
 * Pure function to decide the proxy action based on the URL path.
 * Decoupled from NextRequest/NextResponse for easier testing.
 * Returns null to skip processing (e.g. invalid domains, root path, etc).
 */
export function getProxyAction(path: string): ProxyAction {
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

export function handleProxyRequest(request: NextRequest) {
  const action = getProxyAction(request.nextUrl.pathname);

  if (action === null) {
    return NextResponse.next();
  }

  if (action.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = action.destination;
    url.search = "";
    url.hash = "";
    return NextResponse.redirect(url, {
      headers: {
        "x-middleware-decision": action.type,
      },
    });
  }

  return NextResponse.next({
    headers: {
      "x-middleware-decision": action.type,
    },
  });
}
