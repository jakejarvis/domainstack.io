import { USER_AGENT } from "@/lib/constants";
import { ensureDomainRecord, findDomainByName } from "@/lib/db/repos/domains";
import { getFaviconByDomainId, upsertFavicon } from "@/lib/db/repos/favicons";
import { ttlForFavicon } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import { fetchWithTimeout } from "@/lib/fetch";
import { convertBufferToImageCover } from "@/lib/image";
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
  // Normalize to registrable domain
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Check Postgres for cached favicon
  try {
    const existingDomain = await findDomainByName(registrable);
    if (existingDomain) {
      const faviconRecord = await getFaviconByDomainId(existingDomain.id);
      if (faviconRecord) {
        // Only treat as cache hit if we have a definitive result:
        // - url is present (string), OR
        // - url is null but marked as permanently not found
        const isDefinitiveResult =
          faviconRecord.url !== null || faviconRecord.notFound === true;

        if (isDefinitiveResult) {
          console.debug("[favicon] db cache hit");
          return { url: faviconRecord.url };
        }
      }
    }
  } catch (err) {
    console.warn(
      "[favicon] db read failed",
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // Generate favicon (cache missed)
  const sources = buildSources(registrable);
  let allNotFound = true; // Track if all sources returned 404/not found

  for (const src of sources) {
    try {
      const res = await fetchWithTimeout(
        src,
        {
          redirect: "follow",
          headers: {
            Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
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
        domain: registrable,
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

      // Persist to Postgres
      try {
        const domainRecord = await ensureDomainRecord(registrable);
        const now = new Date();
        const expiresAt = ttlForFavicon(now);

        await upsertFavicon({
          domainId: domainRecord.id,
          url,
          pathname: pathname ?? null,
          size: DEFAULT_SIZE,
          source,
          notFound: false,
          upstreamStatus: res.status,
          upstreamContentType: contentType ?? null,
          fetchedAt: now,
          expiresAt,
        });
      } catch (err) {
        console.error(
          "[favicon] db persist error",
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      return { url };
    } catch {
      // Network error, timeout, etc. - not a true "not found"
      allNotFound = false;
      // try next source
    }
  }

  // All sources failed - persist null result with notFound flag if all were 404s
  try {
    const domainRecord = await ensureDomainRecord(registrable);
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    await upsertFavicon({
      domainId: domainRecord.id,
      url: null,
      pathname: null,
      size: DEFAULT_SIZE,
      source: null,
      notFound: allNotFound,
      upstreamStatus: null,
      upstreamContentType: null,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    console.error(
      "[favicon] db persist error (null)",
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  return { url: null };
}
