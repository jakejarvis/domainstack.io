import { waitUntil } from "@vercel/functions";
import type { Browser } from "puppeteer-core";
import { captureServer } from "@/lib/analytics/server";
import { USER_AGENT } from "@/lib/constants";
import { addWatermarkToScreenshot, optimizeImageCover } from "@/lib/image";
import { launchChromium } from "@/lib/puppeteer";
import { acquireLockOrWaitForResult, ns, redis } from "@/lib/redis";
import { getScreenshotTtlSeconds, uploadImage } from "@/lib/storage";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 8000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 3000;
const CAPTURE_MAX_ATTEMPTS_DEFAULT = 3;
const CAPTURE_BACKOFF_BASE_MS_DEFAULT = 200;
const CAPTURE_BACKOFF_MAX_MS_DEFAULT = 1200;
const LOCK_TTL_SECONDS = 30; // lock TTL for upload coordination

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
  const startedAt = Date.now();
  console.debug("[screenshot] start", {
    domain,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });
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

  // 1) Check Redis index first
  try {
    console.debug("[screenshot] redis get", { key: indexKey });
    const raw = (await redis.get(indexKey)) as { url?: unknown } | null;
    if (raw && typeof raw === "object" && typeof raw.url === "string") {
      console.info("[screenshot] cache hit", {
        domain,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        url: raw.url,
      });
      await captureServer("screenshot_capture", {
        domain,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        source: "redis",
        duration_ms: Date.now() - startedAt,
        outcome: "ok",
        cache: "hit",
      });
      return { url: raw.url };
    }
    console.debug("[screenshot] cache miss", {
      domain,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });
  } catch {
    // ignore and proceed
  }

  // 2) Acquire lock or wait for another process to complete
  const lockResult = await acquireLockOrWaitForResult<{ url: string }>({
    lockKey,
    resultKey: indexKey,
    lockTtl: LOCK_TTL_SECONDS,
  });

  if (!lockResult.acquired) {
    // Another process was working on it
    if (lockResult.cachedResult?.url) {
      console.info("[screenshot] found result from other process", {
        domain,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        url: lockResult.cachedResult.url,
      });
      await captureServer("screenshot_capture", {
        domain,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        source: "redis_wait",
        duration_ms: Date.now() - startedAt,
        outcome: "ok",
        cache: "wait",
      });
      return { url: lockResult.cachedResult.url };
    }
    // Timeout or other process failed - return null
    console.warn("[screenshot] wait timeout, no result", { domain });
    return { url: null };
  }

  // 3) We acquired the lock - attempt to capture
  try {
    let browser: Browser | null = null;
    try {
      browser = await launchChromium();
      console.debug("[screenshot] browser launched", { mode: "chromium" });

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

              console.debug("[screenshot] navigating", {
                url,
                attempt: attemptIndex + 1,
              });
              await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: NAV_TIMEOUT_MS,
              });

              // Give chatty pages/CDNs a brief chance to settle without hanging
              try {
                await page.waitForNetworkIdle({
                  idleTime: IDLE_TIME_MS,
                  timeout: IDLE_TIMEOUT_MS,
                });
              } catch {}

              console.debug("[screenshot] navigated", {
                url,
                attempt: attemptIndex + 1,
              });

              rawPng = (await page.screenshot({
                type: "png",
                fullPage: false,
              })) as Buffer;
            } finally {
              try {
                await page.close();
              } catch {}
            }
            console.debug("[screenshot] raw screenshot bytes", {
              bytes: rawPng.length,
            });

            const png = await optimizeImageCover(
              rawPng,
              VIEWPORT_WIDTH,
              VIEWPORT_HEIGHT,
            );
            if (png && png.length > 0) {
              console.debug("[screenshot] optimized png bytes", {
                bytes: png.length,
              });
              const withWatermark = await addWatermarkToScreenshot(
                png,
                VIEWPORT_WIDTH,
                VIEWPORT_HEIGHT,
              );
              console.debug("[screenshot] watermarked bytes", {
                bytes: withWatermark.length,
              });
              console.info("[screenshot] uploading via uploadthing");
              const { url: storedUrl, key: fileKey } = await uploadImage({
                kind: "screenshot",
                domain,
                width: VIEWPORT_WIDTH,
                height: VIEWPORT_HEIGHT,
                buffer: withWatermark,
              });
              console.info("[screenshot] uploaded", {
                url: storedUrl,
                key: fileKey,
              });

              // Write Redis index and schedule purge
              try {
                const ttl = getScreenshotTtlSeconds();
                const expiresAtMs = Date.now() + ttl * 1000;
                console.debug("[screenshot] redis set index", {
                  key: indexKey,
                  ttlSeconds: ttl,
                  expiresAtMs,
                });
                await redis.set(
                  indexKey,
                  { url: storedUrl, key: fileKey, expiresAtMs },
                  {
                    ex: ttl,
                  },
                );
                console.debug("[screenshot] redis zadd purge", {
                  key: fileKey,
                  expiresAtMs,
                });
                await redis.zadd(ns("purge", "screenshot"), {
                  score: expiresAtMs,
                  member: fileKey, // store UploadThing file key for deletion API
                });
              } catch {
                // best effort
              }

              await captureServer("screenshot_capture", {
                domain,
                width: VIEWPORT_WIDTH,
                height: VIEWPORT_HEIGHT,
                source: url.startsWith("https://")
                  ? "direct_https"
                  : "direct_http",
                duration_ms: Date.now() - startedAt,
                outcome: "ok",
                cache: "store",
              });

              return { url: storedUrl };
            }
          } catch (err) {
            lastError = err;
            const delay = backoffDelayMs(
              attemptIndex,
              backoffBaseMs,
              backoffMaxMs,
            );
            console.warn("[screenshot] attempt failed", {
              url,
              attempt: attemptIndex + 1,
              delay_ms: delay,
              error: (err as Error)?.message,
            });
            if (attemptIndex < attempts - 1) {
              await sleep(delay);
            }
          }
        }

        // Exhausted attempts for this URL, move to next candidate
        if (lastError) {
          console.warn("[screenshot] all attempts failed for url", {
            url,
            attempts,
            error: (lastError as Error)?.message,
          });
        }
      }
    } catch (err) {
      // fallthrough to not_found

      console.error("[screenshot] capture failed", {
        domain,
        error: (err as Error)?.message,
      });
    } finally {
      if (browser) {
        try {
          waitUntil(browser.close());
        } catch {}
      }
    }

    await captureServer("screenshot_capture", {
      domain,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      duration_ms: Date.now() - startedAt,
      outcome: "not_found",
      cache: "miss",
    });

    console.warn("[screenshot] returning null", { domain });
    return { url: null };
  } finally {
    // Release lock (best effort)
    try {
      await redis.del(lockKey);
    } catch {
      // ignore
    }
  }
}
