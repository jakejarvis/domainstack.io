import type { Browser } from "puppeteer-core";
import { getOrCreateCachedAsset } from "@/lib/cache";
import { SCREENSHOT_TTL_SECONDS, USER_AGENT } from "@/lib/constants";
import { addWatermarkToScreenshot, optimizeImageCover } from "@/lib/image";
import { launchChromium } from "@/lib/puppeteer";
import { ns } from "@/lib/redis";
import { storeImage } from "@/lib/storage";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 8000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 3000;
const CAPTURE_MAX_ATTEMPTS_DEFAULT = 3;
const CAPTURE_BACKOFF_BASE_MS_DEFAULT = 200;
const CAPTURE_BACKOFF_MAX_MS_DEFAULT = 1200;

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

export async function getOrCreateScreenshotBlobUrl(
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
  const indexKey = ns(
    "screenshot",
    "url",
    domain,
    `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}`,
  );
  const lockKey = ns(
    "lock",
    "screenshot",
    domain,
    `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}`,
  );
  const ttl = SCREENSHOT_TTL_SECONDS;

  return await getOrCreateCachedAsset({
    indexKey,
    lockKey,
    ttlSeconds: ttl,
    purgeQueue: "screenshot",
    produceAndUpload: async () => {
      let browser: Browser | null = null;
      try {
        browser = await launchChromium();
        const tryUrls = buildHomepageUrls(domain);
        for (const url of tryUrls) {
          let lastError: unknown = null;
          for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex++) {
            try {
              const page = await browser.newPage();
              let rawPng: Buffer;
              try {
                await page.setViewport({
                  width: VIEWPORT_WIDTH,
                  height: VIEWPORT_HEIGHT,
                  deviceScaleFactor: 1,
                });
                await page.setUserAgent(USER_AGENT);
                await page.goto(url, {
                  waitUntil: "domcontentloaded",
                  timeout: NAV_TIMEOUT_MS,
                });
                try {
                  await page.waitForNetworkIdle({
                    idleTime: IDLE_TIME_MS,
                    timeout: IDLE_TIMEOUT_MS,
                  });
                } catch {}
                rawPng = (await page.screenshot({
                  type: "png",
                  fullPage: false,
                })) as Buffer;
              } finally {
                try {
                  await page.close();
                } catch {}
              }
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
              return {
                url: storedUrl,
                key: pathname,
                metrics: {
                  source: url.startsWith("https://")
                    ? "direct_https"
                    : "direct_http",
                },
              };
            } catch (err) {
              lastError = err;
              const delay = backoffDelayMs(
                attemptIndex,
                backoffBaseMs,
                backoffMaxMs,
              );
              if (attemptIndex < attempts - 1) {
                await sleep(delay);
              }
            }
          }
          if (lastError) {
            // try next candidate url
          }
        }
        return { url: null };
      } finally {
        if (browser) {
          try {
            await browser.close();
          } catch {}
        }
      }
    },
  });
}
