import { createLogger } from "@domainstack/logger";
import type { Browser, Page, Viewport } from "puppeteer-core";

const logger = createLogger({ source: "screenshot/page" });

const DEFAULT_VIEWPORT_WIDTH = 1200;
const DEFAULT_VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 5000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 1500;

export interface CreatePageOptions {
  viewport?: Viewport;
}

/**
 * Create a page that's ready to be screenshotted.
 * Includes ad blocking and network idle detection.
 */
export async function createPage(
  browser: Browser,
  url: string,
  options: CreatePageOptions = {},
): Promise<Page | null> {
  let page: Page | null = null;

  // Initialize adblocker once and reuse for all pages
  // biome-ignore lint/suspicious/noExplicitAny: PuppeteerBlocker type is complex to infer from dynamic import
  let blocker: any = null;
  try {
    const { PuppeteerBlocker } = await import("@ghostery/adblocker-puppeteer");
    blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking();
  } catch (err) {
    logger.warn(err, "failed to initialize adblocker");
  }

  try {
    if (!page) {
      page = await browser.newPage();
    }

    // Enable adblocker if initialized, but don't throw if it fails
    if (blocker) {
      try {
        await blocker.enableBlockingInPage(page);
      } catch (err) {
        logger.warn(err, "failed to enable adblocker");
      }
    }

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    try {
      await page.waitForNetworkIdle({
        idleTime: IDLE_TIME_MS,
        timeout: IDLE_TIMEOUT_MS,
      });
    } catch {
      // Network idle timeout is not critical
    }

    page.on("console", (msg) => {
      logger.debug({ source: "chromium", msg });
    });

    await page.setViewport({
      width: options.viewport?.width ?? DEFAULT_VIEWPORT_WIDTH,
      height: options.viewport?.height ?? DEFAULT_VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
    });

    return page;
  } catch (err) {
    logger.warn(err, "failed to create page");
    throw err;
  }
}
