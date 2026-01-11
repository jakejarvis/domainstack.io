import "server-only";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "puppeteer" });

let browserPromise: Promise<import("puppeteer-core").Browser> | null = null;

async function createBrowser(
  overrides: Record<string, unknown> = {},
): Promise<import("puppeteer-core").Browser> {
  const isVercel = Boolean(process.env.VERCEL);

  // Always include a minimal set of stability flags; merge with env-specific args
  const stabilityArgs = [
    "--disable-dev-shm-usage", // avoid tiny /dev/shm; use /tmp instead
    "--no-first-run",
    "--no-default-browser-check",
  ];
  const overrideArgs = (overrides as { args?: unknown }).args;
  const extraArgs = Array.isArray(overrideArgs)
    ? (overrideArgs as string[])
    : [];

  const { args: _ignoredArgs, ...restOverrides } = overrides as {
    args?: unknown;
    [key: string]: unknown;
  };

  if (isVercel) {
    // Vercel: use @sparticuz/chromium + puppeteer-core
    const chromium = (await import("@sparticuz/chromium")).default;
    const { launch } = await import("puppeteer-core");
    const executablePath = await chromium.executablePath();

    const baseArgs = Array.isArray(
      (chromium as unknown as { args?: unknown }).args,
    )
      ? (chromium.args as string[])
      : [];

    // Dedupe while preserving order: base -> stability -> overrides
    const seen = new Set<string>();
    const mergedArgs = [...baseArgs, ...stabilityArgs, ...extraArgs].filter(
      (arg) => {
        if (typeof arg !== "string") return false;
        if (seen.has(arg)) return false;
        seen.add(arg);
        return true;
      },
    );

    return launch({
      headless: true,
      args: mergedArgs,
      executablePath,
      defaultViewport: null,
      ...restOverrides,
    });
  }

  // Local development: prefer full puppeteer (bundled Chromium) if available,
  // otherwise fall back to puppeteer-core with a provided executable path.
  try {
    // Attempt to use full puppeteer locally for convenience
    const puppeteer = await import("puppeteer");
    const seen = new Set<string>();
    const mergedArgs = [...stabilityArgs, ...extraArgs].filter((arg) => {
      if (typeof arg !== "string") return false;
      if (seen.has(arg)) return false;
      seen.add(arg);
      return true;
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: mergedArgs,
      defaultViewport: null,
      ...restOverrides,
    } as never);
    return browser as unknown as import("puppeteer-core").Browser;
  } catch {
    // Fallback: require an explicit executable path for a locally installed Chrome/Chromium
    const { launch } = await import("puppeteer-core");
    const executablePath =
      (process.env.PUPPETEER_EXECUTABLE_PATH &&
        String(process.env.PUPPETEER_EXECUTABLE_PATH)) ||
      (process.env.CHROME_EXECUTABLE_PATH &&
        String(process.env.CHROME_EXECUTABLE_PATH)) ||
      undefined;

    if (!executablePath) {
      throw new Error(
        "Missing PUPPETEER_EXECUTABLE_PATH for local Chrome/Chromium. Install 'puppeteer' or set the env var.",
      );
    }

    const seen = new Set<string>();
    const mergedArgs = [...stabilityArgs, ...extraArgs].filter((arg) => {
      if (typeof arg !== "string") return false;
      if (seen.has(arg)) return false;
      seen.add(arg);
      return true;
    });

    return launch({
      headless: true,
      args: mergedArgs,
      executablePath,
      defaultViewport: null,
      ...restOverrides,
    });
  }
}

export function getBrowser(
  overrides: Record<string, unknown> = {},
): Promise<import("puppeteer-core").Browser> {
  if (!browserPromise) {
    browserPromise = createBrowser(overrides).catch((err) => {
      logger.error(err, "failed to create browser");
      // Reset promise to allow retry on next call
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 5000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 1500;

interface CreatePageOptions {
  viewport?: import("puppeteer-core").Viewport;
}

/**
 * Create a page that's ready to be screenshotted
 */
export async function createPage(
  browser: import("puppeteer-core").Browser,
  url: string,
  options: CreatePageOptions = {},
): Promise<import("puppeteer-core").Page | null> {
  let page: import("puppeteer-core").Page | null = null;

  // Initialize adblocker once and reuse for all pages
  // Using any to avoid complex type inference for dynamically imported class
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

    // if (process.env.NODE_ENV === "development") {
    page.on("console", (msg) => {
      logger.debug({ source: "chromium", msg });
    });
    // }

    await page.setViewport({
      width: options.viewport?.width ?? VIEWPORT_WIDTH,
      height: options.viewport?.height ?? VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
    });

    return page;
  } catch (err) {
    logger.warn(err, "failed to create page");
    throw err;
  }
}

async function closeBrowser(): Promise<void> {
  if (!browserPromise) {
    return;
  }

  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (err) {
    logger.error(err, "failed to close browser");
  } finally {
    browserPromise = null;
  }
}

if (process.env.NODE_ENV !== "test") {
  const handleShutdown = async (signal: string) => {
    logger.debug(`received ${signal}, closing browser`);
    await closeBrowser();
    process.exit(0);
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

export type { Browser, Page } from "puppeteer-core";
