import { getOrCreateCachedAsset } from "@/lib/cache";
import { TTL_FAVICON, USER_AGENT } from "@/lib/constants";
import { fetchWithTimeout } from "@/lib/fetch";
import { convertBufferToImageCover } from "@/lib/image";
import { ns } from "@/lib/redis";
import { storeImage } from "@/lib/storage";

const DEFAULT_SIZE = 32;
const REQUEST_TIMEOUT_MS = 1500; // per each method

function buildSources(domain: string): string[] {
  const enc = encodeURIComponent(domain);
  return [
    `https://icons.duckduckgo.com/ip3/${enc}.ico`,
    `https://www.google.com/s2/favicons?domain=${enc}&sz=${DEFAULT_SIZE}`,
    `https://${domain}/favicon.ico`,
    `http://${domain}/favicon.ico`,
  ];
}

export async function getOrCreateFaviconBlobUrl(
  domain: string,
): Promise<{ url: string | null }> {
  const indexKey = ns("favicon", "url", domain, String(DEFAULT_SIZE));
  const lockKey = ns("lock", "favicon", domain, String(DEFAULT_SIZE));
  const ttl = TTL_FAVICON;

  return await getOrCreateCachedAsset({
    indexKey,
    lockKey,
    ttlSeconds: ttl,
    purgeQueue: "favicon",
    produceAndUpload: async () => {
      const sources = buildSources(domain);
      let allNotFound = true; // Track if all sources returned 404/not found

      for (const src of sources) {
        try {
          const res = await fetchWithTimeout(
            src,
            {
              redirect: "follow",
              headers: {
                Accept:
                  "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
                "User-Agent": USER_AGENT,
              },
            },
            { timeoutMs: REQUEST_TIMEOUT_MS },
          );
          if (!res.ok) {
            // Track if this was a 404 (not found) vs other error
            if (res.status !== 404) {
              allNotFound = false; // Server error, timeout, etc. - not a true "not found"
            }
            continue;
          }
          const contentType = res.headers.get("content-type");
          const ab = await res.arrayBuffer();
          const buf = Buffer.from(ab);
          const webp = await convertBufferToImageCover(
            buf,
            DEFAULT_SIZE,
            DEFAULT_SIZE,
            contentType,
          );
          if (!webp) continue;
          const { url, pathname } = await storeImage({
            kind: "favicon",
            domain,
            buffer: webp,
            width: DEFAULT_SIZE,
            height: DEFAULT_SIZE,
          });
          const source = (() => {
            if (src.includes("icons.duckduckgo.com")) return "duckduckgo";
            if (src.includes("www.google.com/s2/favicons")) return "google";
            if (src.startsWith("https://")) return "direct_https";
            if (src.startsWith("http://")) return "direct_http";
            return "unknown";
          })();
          return {
            url,
            key: pathname,
            metrics: {
              source,
              upstream_status: res.status,
              upstream_content_type: contentType ?? null,
            },
          };
        } catch {
          // Network error, timeout, etc. - not a true "not found"
          allNotFound = false;
          // try next source
        }
      }
      // Return null with notFound flag if ALL sources returned 404
      return { url: null, notFound: allNotFound };
    },
  });
}
