import { eq } from "drizzle-orm";
import { recordDomainAccess } from "@/lib/access";
import { acquireLockOrWaitForResult } from "@/lib/cache";
import { TTL_SOCIAL_PREVIEW, USER_AGENT } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { upsertSeo } from "@/lib/db/repos/seo";
import { seo as seoTable } from "@/lib/db/schema";
import { ttlForSeo } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import { fetchWithTimeout } from "@/lib/fetch";
import { optimizeImageCover } from "@/lib/image";
import { ns, redis } from "@/lib/redis";
import { scheduleSectionIfEarlier } from "@/lib/schedule";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/schemas";
import { parseHtmlMeta, parseRobotsTxt, selectPreview } from "@/lib/seo";
import { storeImage } from "@/lib/storage";

const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;

export async function getSeo(domain: string): Promise<SeoResponse> {
  console.debug(`[seo] start ${domain}`);

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Fast path: Check Postgres for cached SEO data
  const existingDomain = await findDomainByName(registrable);
  const existing = existingDomain
    ? await db
        .select({
          sourceFinalUrl: seoTable.sourceFinalUrl,
          sourceStatus: seoTable.sourceStatus,
          metaOpenGraph: seoTable.metaOpenGraph,
          metaTwitter: seoTable.metaTwitter,
          metaGeneral: seoTable.metaGeneral,
          previewTitle: seoTable.previewTitle,
          previewDescription: seoTable.previewDescription,
          previewImageUrl: seoTable.previewImageUrl,
          canonicalUrl: seoTable.canonicalUrl,
          robots: seoTable.robots,
          errors: seoTable.errors,
          expiresAt: seoTable.expiresAt,
        })
        .from(seoTable)
        .where(eq(seoTable.domainId, existingDomain.id))
    : ([] as Array<{
        sourceFinalUrl: string | null;
        sourceStatus: number | null;
        metaOpenGraph: OpenGraphMeta;
        metaTwitter: TwitterMeta;
        metaGeneral: GeneralMeta;
        previewTitle: string | null;
        previewDescription: string | null;
        previewImageUrl: string | null;
        canonicalUrl: string | null;
        robots: RobotsTxt;
        errors: Record<string, unknown>;
        expiresAt: Date | null;
      }>);
  if (existing[0] && (existing[0].expiresAt?.getTime?.() ?? 0) > Date.now()) {
    const preview = existing[0].canonicalUrl
      ? {
          title: existing[0].previewTitle ?? null,
          description: existing[0].previewDescription ?? null,
          image: existing[0].previewImageUrl ?? null,
          imageUploaded: null as string | null, // Will be fetched from Redis below
          canonicalUrl: existing[0].canonicalUrl,
        }
      : null;
    // Ensure uploaded image URL is still valid; refresh via Redis-backed cache
    if (preview?.image) {
      try {
        const refreshed = await getOrCreateSocialPreviewImageUrl(
          registrable,
          preview.image,
        );
        preview.imageUploaded = refreshed?.url ?? null;
      } catch {
        // keep as-is on transient errors
      }
    }

    // Normalize robots: convert empty object to valid RobotsTxt structure
    const robotsData = existing[0].robots as RobotsTxt;
    const normalizedRobots: RobotsTxt =
      robotsData && "fetched" in robotsData
        ? robotsData
        : { fetched: false, groups: [], sitemaps: [] };

    const response: SeoResponse = {
      meta: {
        openGraph: existing[0].metaOpenGraph as OpenGraphMeta,
        twitter: existing[0].metaTwitter as TwitterMeta,
        general: existing[0].metaGeneral as GeneralMeta,
      },
      robots: normalizedRobots,
      preview,
      source: {
        finalUrl: existing[0].sourceFinalUrl ?? null,
        status: existing[0].sourceStatus ?? null,
      },
      errors: existing[0].errors as Record<string, unknown> as {
        html?: string;
        robots?: string;
      },
    };
    return response;
  }

  let finalUrl: string = `https://${registrable}/`;
  let status: number | null = null;
  let htmlError: string | undefined;
  let robotsError: string | undefined;

  let meta: ReturnType<typeof parseHtmlMeta> | null = null;
  let robots: ReturnType<typeof parseRobotsTxt> | null = null;

  // HTML fetch
  try {
    const res = await fetchWithTimeout(
      finalUrl,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
          "User-Agent": USER_AGENT,
        },
      },
      { timeoutMs: 10000, retries: 1, backoffMs: 200 },
    );
    status = res.status;
    finalUrl = res.url;
    const contentType = res.headers.get("content-type") ?? "";
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
      htmlError = `Non-HTML content-type: ${contentType}`;
    } else {
      const text = await res.text();
      const max = 512 * 1024;
      const html = text.length > max ? text.slice(0, max) : text;
      meta = parseHtmlMeta(html, finalUrl);
    }
  } catch (err) {
    htmlError = String(err);
  }

  // robots.txt fetch (no Redis cache; stored in Postgres with row TTL)
  try {
    const robotsUrl = `https://${registrable}/robots.txt`;
    const res = await fetchWithTimeout(
      robotsUrl,
      {
        method: "GET",
        headers: { Accept: "text/plain", "User-Agent": USER_AGENT },
      },
      { timeoutMs: 8000 },
    );
    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (/^text\/(plain|html|xml)?($|;|,)/i.test(ct)) {
        const txt = await res.text();
        robots = parseRobotsTxt(txt, { baseUrl: robotsUrl });
      } else {
        robotsError = `Unexpected robots content-type: ${ct}`;
      }
    } else {
      robotsError = `HTTP ${res.status}`;
    }
  } catch (err) {
    robotsError = String(err);
  }

  const preview = meta ? selectPreview(meta, finalUrl) : null;

  // If a social preview image is present, store a cached copy via Vercel Blob for privacy
  if (preview?.image) {
    try {
      const stored = await getOrCreateSocialPreviewImageUrl(
        registrable,
        preview.image,
      );
      // Preserve original image URL for meta display; attach uploaded URL for rendering
      preview.imageUploaded = stored?.url ?? null;
    } catch {
      // On failure, avoid rendering external image URL
      preview.imageUploaded = null;
    }
  }

  const response: SeoResponse = {
    meta,
    robots,
    preview,
    source: { finalUrl, status },
    ...(htmlError || robotsError
      ? {
          errors: {
            ...(htmlError ? { html: htmlError } : {}),
            ...(robotsError ? { robots: robotsError } : {}),
          },
        }
      : {}),
  };

  // Persist to Postgres only if domain exists (i.e., is registered)
  const now = new Date();
  const expiresAt = ttlForSeo(now);
  const dueAtMs = expiresAt.getTime();

  if (existingDomain) {
    await upsertSeo({
      domainId: existingDomain.id,
      sourceFinalUrl: response.source.finalUrl ?? null,
      sourceStatus: response.source.status ?? null,
      metaOpenGraph: response.meta?.openGraph ?? ({} as OpenGraphMeta),
      metaTwitter: response.meta?.twitter ?? ({} as TwitterMeta),
      metaGeneral: response.meta?.general ?? ({} as GeneralMeta),
      previewTitle: response.preview?.title ?? null,
      previewDescription: response.preview?.description ?? null,
      previewImageUrl: response.preview?.image ?? null,
      canonicalUrl: response.preview?.canonicalUrl ?? null,
      robots: robots ?? { fetched: false, groups: [], sitemaps: [] },
      robotsSitemaps: response.robots?.sitemaps ?? [],
      errors: response.errors ?? {},
      fetchedAt: now,
      expiresAt,
    });

    // Record access for decay calculation
    recordDomainAccess(registrable);

    try {
      await scheduleSectionIfEarlier(
        "seo",
        registrable,
        dueAtMs,
        existingDomain.lastAccessedAt,
      );
    } catch (err) {
      console.warn(
        `[seo] schedule failed for ${registrable}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  console.info(
    `[seo] ok ${registrable} status=${status ?? -1} has_meta=${!!meta} has_robots=${!!robots} has_errors=${Boolean(htmlError || robotsError)}`,
  );

  return response;
}

async function getOrCreateSocialPreviewImageUrl(
  domain: string,
  imageUrl: string,
): Promise<{ url: string | null }> {
  // Guard against non-http(s) schemes to avoid SSRF or unsupported fetches
  try {
    const u = new URL(imageUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { url: null };
    }
  } catch {
    // Invalid URL
    return { url: null };
  }

  const lower = domain.toLowerCase();
  const indexKey = ns(
    "seo-image",
    "url",
    lower,
    `${SOCIAL_WIDTH}x${SOCIAL_HEIGHT}`,
  );
  const lockKey = ns(
    "lock",
    "seo-image",
    lower,
    `${SOCIAL_WIDTH}x${SOCIAL_HEIGHT}`,
  );

  // 1) Check Redis index first
  try {
    const raw = (await redis.get(indexKey)) as { url?: unknown } | null;
    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as { url?: unknown }).url === "string"
    ) {
      return { url: (raw as { url: string }).url };
    }
  } catch {
    // ignore and continue
  }

  // 2) Acquire lock or wait for another process to complete
  const lockResult = await acquireLockOrWaitForResult<{ url: string }>({
    lockKey,
    resultKey: indexKey,
    lockTtl: 30,
  });

  if (!lockResult.acquired) {
    if (lockResult.cachedResult?.url) {
      return { url: lockResult.cachedResult.url };
    }
    return { url: null };
  }

  // 3) We acquired the lock - fetch, process, upload
  try {
    const res = await fetchWithTimeout(
      imageUrl,
      {
        method: "GET",
        headers: {
          Accept:
            "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT,
        },
      },
      { timeoutMs: 8000 },
    );

    if (!res.ok) return { url: null };
    const contentType = res.headers.get("content-type") ?? "";
    if (!/image\//.test(contentType)) return { url: null };

    const ab = await res.arrayBuffer();
    const raw = Buffer.from(ab);

    const image = await optimizeImageCover(raw, SOCIAL_WIDTH, SOCIAL_HEIGHT);
    if (!image || image.length === 0) return { url: null };

    const { url, pathname } = await storeImage({
      kind: "social",
      domain: lower,
      buffer: image,
      width: SOCIAL_WIDTH,
      height: SOCIAL_HEIGHT,
    });

    try {
      const ttl = TTL_SOCIAL_PREVIEW;
      const expiresAtMs = Date.now() + ttl * 1000;
      await redis.set(
        indexKey,
        { url, key: pathname, expiresAtMs },
        { ex: ttl },
      );
      await redis.zadd(ns("purge", "social"), {
        score: expiresAtMs,
        member: url,
      });
    } catch {}

    return { url };
  } catch {
    return { url: null };
  } finally {
    try {
      await redis.del(lockKey);
    } catch {}
  }
}
