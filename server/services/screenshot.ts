import type { Browser } from "puppeteer-core";
import { USER_AGENT } from "@/lib/constants/app";
import { isDomainBlocked } from "@/lib/db/repos/blocked-domains";
import { ensureDomainRecord, findDomainByName } from "@/lib/db/repos/domains";
import {
  getScreenshotByDomainId,
  upsertScreenshot,
} from "@/lib/db/repos/screenshots";
import { addWatermarkToScreenshot, optimizeImageCover } from "@/lib/image";
import { createLogger } from "@/lib/logger/server";
import { getBrowser } from "@/lib/puppeteer";
import type { BlobUrlWithBlockedFlagResponse } from "@/lib/schemas";
import { storeImage } from "@/lib/storage";
import { ttlForScreenshot } from "@/lib/ttl";

const logger = createLogger({ source: "screenshot" });

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 8000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 3000;
const CAPTURE_MAX_ATTEMPTS_DEFAULT = 3;
const CAPTURE_BACKOFF_BASE_MS_DEFAULT = 200;
const CAPTURE_BACKOFF_MAX_MS_DEFAULT = 1200;

// In-memory lock to prevent concurrent screenshot generation for the same domain
const screenshotPromises = new Map<string, Promise<{ url: string | null }>>();

// Safety timeout for cleaning up stale promises (60 seconds)
const PROMISE_CLEANUP_TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(
  attemptIndex: number,
  baseMs: number,
  maxMs: number,
): number {
  const base = Math.min(maxMs, baseMs * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * Math.min(base, maxMs) * 0.25);
  return Math.min(base + jitter, maxMs);
}

function buildHomepageUrls(domain: string): string[] {
  return [`https://${domain}`, `http://${domain}`];
}

export async function getScreenshot(
  domain: string,
  options?: {
    attempts?: number;
    backoffBaseMs?: number;
    backoffMaxMs?: number;
  },
): Promise<BlobUrlWithBlockedFlagResponse> {
  // Input domain is already normalized to registrable domain by router schema

  // Check blocklist before any expensive operations
  if (await isDomainBlocked(domain)) {
    logger.info({ domain }, "screenshot blocked");
    return { url: null, blocked: true };
  }

  // Check for in-flight request
  if (screenshotPromises.has(domain)) {
    // biome-ignore lint/style/noNonNullAssertion: checked above
    return screenshotPromises.get(domain)!;
  }

  // Create a new promise with guaranteed cleanup
  const promise = (async () => {
    try {
      return await generateScreenshot(domain, options);
    } finally {
      // Remove the promise from the map once it's settled
      screenshotPromises.delete(domain);
    }
  })();

  // Store promise with safety timeout cleanup
  screenshotPromises.set(domain, promise);

  // Safety: Auto-cleanup stale promise after timeout to prevent memory leak
  // This catches edge cases where promise never settles
  const timeoutId = setTimeout(() => {
    if (screenshotPromises.get(domain) === promise) {
      logger.warn("cleaning up stale promise");
      screenshotPromises.delete(domain);
    }
  }, PROMISE_CLEANUP_TIMEOUT_MS);

  // Clear timeout when promise settles to avoid unnecessary work
  void promise.finally(() => clearTimeout(timeoutId));

  // Log map size for monitoring
  if (screenshotPromises.size > 10) {
    logger.warn("promise map size high (potential memory pressure)");
  }

  return promise;
}

async function generateScreenshot(
  domain: string,
  options?: {
    attempts?: number;
    backoffBaseMs?: number;
    backoffMaxMs?: number;
  },
): Promise<{ url: string | null }> {
  const attempts = Math.max(
    1,
    options?.attempts ?? CAPTURE_MAX_ATTEMPTS_DEFAULT,
  );
  const backoffBaseMs =
    options?.backoffBaseMs ?? CAPTURE_BACKOFF_BASE_MS_DEFAULT;
  const backoffMaxMs = options?.backoffMaxMs ?? CAPTURE_BACKOFF_MAX_MS_DEFAULT;

  // Check Postgres for cached screenshot
  try {
    const existingDomain = await findDomainByName(domain);
    if (existingDomain) {
      const screenshotRecord = await getScreenshotByDomainId(existingDomain.id);
      if (screenshotRecord) {
        // Only treat as cache hit if we have a definitive result:
        // - url is present (string), OR
        // - url is null but marked as permanently not found
        const isDefinitiveResult =
          screenshotRecord.url !== null || screenshotRecord.notFound === true;

        if (isDefinitiveResult) {
          // Postgres cache hit
          return { url: screenshotRecord.url };
        }
      }
    }
  } catch (err) {
    logger.error({ err, domain });
  }

  // Generate screenshot (cache missed)
  let resultUrl: string | null = null;
  let isPermanentFailure = false;
  let browser: Browser | null = null;
  try {
    browser = await getBrowser();

    const tryUrls = buildHomepageUrls(domain);
    const permanentFailureUrls = new Set<string>();

    urlLoop: for (const url of tryUrls) {
      let lastError: unknown = null;

      for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex++) {
        let page: import("puppeteer-core").Page | null = null;
        try {
          page = await browser.newPage();

          await page.setViewport({
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            deviceScaleFactor: 1,
          });
          await page.setUserAgent(USER_AGENT);

          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: NAV_TIMEOUT_MS,
          });

          // Check for permanent failure signals (404, 410 Gone, etc.)
          if (response) {
            const status = response.status();
            if (status === 404 || status === 410) {
              permanentFailureUrls.add(url);
              break; // No point retrying this specific URL
            }
          }

          try {
            await page.waitForNetworkIdle({
              idleTime: IDLE_TIME_MS,
              timeout: IDLE_TIMEOUT_MS,
            });
          } catch {}

          const rawPng = (await page.screenshot({
            type: "png",
            fullPage: false,
          })) as Buffer;
          const png = await optimizeImageCover(
            rawPng,
            VIEWPORT_WIDTH,
            VIEWPORT_HEIGHT,
          );
          if (!png || png.length === 0) continue;
          const withWatermark = await addWatermarkToScreenshot(
            png,
            VIEWPORT_WIDTH,
            VIEWPORT_HEIGHT,
          );
          const { url: storedUrl, pathname } = await storeImage({
            kind: "screenshot",
            domain,
            buffer: withWatermark,
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
          });

          const source = url.startsWith("https://")
            ? "direct_https"
            : "direct_http";

          // Persist to Postgres
          try {
            const domainRecord = await ensureDomainRecord(domain);
            const now = new Date();
            const expiresAt = ttlForScreenshot(now);

            await upsertScreenshot({
              domainId: domainRecord.id,
              url: storedUrl,
              pathname: pathname ?? null,
              width: VIEWPORT_WIDTH,
              height: VIEWPORT_HEIGHT,
              source,
              notFound: false,
              fetchedAt: now,
              expiresAt,
            });
          } catch (err) {
            logger.error({ err, domain });
          }
          resultUrl = storedUrl;
          break urlLoop;
        } catch (err) {
          lastError = err;
          // Log when final attempt for this URL fails
          if (attemptIndex === attempts - 1) {
            logger.info(
              {
                err,
                domain,
                url,
                attempt: attemptIndex + 1,
              },
              "screenshot attempts exhausted, giving up",
            );
          }
          const delay = backoffDelayMs(
            attemptIndex,
            backoffBaseMs,
            backoffMaxMs,
          );
          if (attemptIndex < attempts - 1) {
            await sleep(delay);
          }
        } finally {
          if (page) {
            try {
              await page.close();
            } catch (err) {
              logger.error({ err, domain }, "failed to close page");
            }
          }
        }
      }
      // Continue to next URL - don't break early on single URL failure
      if (lastError) {
        // Transient failure - try next candidate URL
      }
    }

    // Only mark as permanently failed if ALL candidate URLs returned permanent signals
    if (permanentFailureUrls.size === tryUrls.length && tryUrls.length > 0) {
      isPermanentFailure = true;
    }

    // All attempts failed - persist result based on failure type
    if (!resultUrl) {
      try {
        const domainRecord = await ensureDomainRecord(domain);
        const now = new Date();
        const expiresAt = ttlForScreenshot(now);

        // Only set notFound: true for definitive failures (404/410)
        // For transient failures (timeouts, network errors), set notFound: false
        // so cache check doesn't treat it as definitive and allows retry after TTL
        await upsertScreenshot({
          domainId: domainRecord.id,
          url: null,
          pathname: null,
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          source: null,
          notFound: isPermanentFailure,
          fetchedAt: now,
          expiresAt,
        });
      } catch (err) {
        logger.error({ err, domain });
      }
    }
  } catch (err) {
    logger.error({ err, domain });
  }

  return { url: resultUrl };
}
