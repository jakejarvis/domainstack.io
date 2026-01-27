import {
  TTL_AVATAR_BROWSER,
  TTL_AVATAR_CDN,
  TTL_AVATAR_STALE,
} from "@domainstack/constants";
import { SafeFetchError, safeFetch } from "@domainstack/safe-fetch";
import { connection, type NextRequest, NextResponse } from "next/server";
import { getUserAvatarUrl } from "@/lib/db/repos/users";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "api/avatar" });

// Maximum avatar size to proxy (4MB)
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

// Request timeout
const REQUEST_TIMEOUT_MS = 5000;

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/avatar/[userId]">,
): Promise<NextResponse> {
  await connection();

  const { userId } = await context.params;

  if (!userId) {
    return new NextResponse("User ID required", { status: 400 });
  }

  // Look up user's avatar URL
  const avatarUrl = await getUserAvatarUrl(userId);

  if (!avatarUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Fetch the avatar from the OAuth provider
  // safeFetch handles:
  // - SSRF protection (private IP blocking, DNS validation)
  // - Redirect re-validation against allowlist
  // - Streaming size limits
  try {
    const asset = await safeFetch({
      url: avatarUrl,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      headers: { Accept: "image/*" },
      maxBytes: MAX_AVATAR_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    // Check for non-OK responses
    if (!asset.ok) {
      return new NextResponse("Upstream error", { status: 502 });
    }

    // Validate content type is a safe image format (block SVGs which can contain scripts)
    const { contentType } = asset;
    if (!contentType?.startsWith("image/") || contentType === "image/svg+xml") {
      logger.warn(
        { userId, contentType },
        "upstream returned invalid content type",
      );
      return new NextResponse("Invalid content type", { status: 502 });
    }

    // Build cache headers for CDN and browser caching
    // - public: Allow CDN caching
    // - max-age: Browser cache duration
    // - s-maxage: CDN cache duration
    // - stale-while-revalidate: Serve stale while fetching fresh in background
    const cacheControl = [
      "public",
      `max-age=${TTL_AVATAR_BROWSER}`,
      `s-maxage=${TTL_AVATAR_CDN}`,
      `stale-while-revalidate=${TTL_AVATAR_STALE}`,
    ].join(", ");

    return new NextResponse(new Uint8Array(asset.buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (err) {
    // Only infrastructure errors (DNS, private IP, size limits, etc.) are thrown
    if (err instanceof SafeFetchError) {
      switch (err.code) {
        case "host_not_allowed":
        case "host_blocked":
        case "private_ip":
          return new NextResponse("Avatar host not allowed", { status: 403 });
        case "size_exceeded":
          return new NextResponse("Avatar too large", { status: 413 });
        default:
          return new NextResponse("Failed to fetch avatar", { status: 502 });
      }
    }

    logger.error({ err, userId }, "unexpected error fetching avatar");
    return new NextResponse("Failed to fetch avatar", { status: 502 });
  }
}
