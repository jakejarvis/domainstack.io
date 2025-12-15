import { connection, type NextRequest, NextResponse } from "next/server";
import {
  TTL_AVATAR_BROWSER,
  TTL_AVATAR_CDN,
  TTL_AVATAR_STALE,
} from "@/lib/constants/ttl";
import { getUserAvatarUrl } from "@/lib/db/repos/users";
import { fetchRemoteAsset, RemoteAssetError } from "@/lib/fetch-remote-asset";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "avatar-api" });

// Maximum avatar size to proxy (1MB)
const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

// Request timeout
const REQUEST_TIMEOUT_MS = 5000;

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      userId: string;
    }>;
  },
): Promise<NextResponse> {
  await connection();

  const { userId } = await context.params;

  if (!userId) {
    return new NextResponse("User ID required", { status: 400 });
  }

  // Look up user's avatar URL
  const avatarUrl = await getUserAvatarUrl(userId);

  if (!avatarUrl) {
    logger.debug("no avatar found for user", { userId });
    return new NextResponse("Not found", { status: 404 });
  }

  // Fetch the avatar from the OAuth provider
  // fetchRemoteAsset handles:
  // - SSRF protection (private IP blocking, DNS validation)
  // - Redirect re-validation against allowlist
  // - Streaming size limits
  try {
    const asset = await fetchRemoteAsset({
      url: avatarUrl,
      headers: { Accept: "image/*" },
      maxBytes: MAX_AVATAR_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    // Validate content type is a safe image format (block SVGs which can contain scripts)
    const contentType = asset.contentType;
    if (!contentType?.startsWith("image/") || contentType === "image/svg+xml") {
      logger.warn("upstream returned invalid content type", {
        userId,
        contentType,
      });
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

    logger.debug("serving avatar", { userId, contentType });

    return new NextResponse(new Uint8Array(asset.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        // CDN cache key varies by user ID (already in URL path)
        // but add Vary header for Accept to handle format negotiation
        Vary: "Accept",
        // Security headers
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof RemoteAssetError) {
      logger.warn("avatar fetch failed", {
        userId,
        code: err.code,
        status: err.status,
      });

      switch (err.code) {
        case "host_not_allowed":
        case "host_blocked":
        case "private_ip":
          return new NextResponse("Avatar host not allowed", { status: 403 });
        case "size_exceeded":
          return new NextResponse("Avatar too large", { status: 413 });
        case "response_error":
          return new NextResponse("Upstream error", { status: 502 });
        default:
          return new NextResponse("Failed to fetch avatar", { status: 502 });
      }
    }

    logger.error("failed to fetch avatar", err, { userId });
    return new NextResponse("Failed to fetch avatar", { status: 502 });
  }
}
