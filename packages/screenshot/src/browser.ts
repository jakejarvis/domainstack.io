import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "screenshot/browser" });

let browserPromise: Promise<import("puppeteer-core").Browser> | null = null;
let closingPromise: Promise<void> | null = null;

// Stability flags always included for browser launch
const STABILITY_ARGS = [
  "--disable-dev-shm-usage", // avoid tiny /dev/shm; use /tmp instead
  "--no-first-run",
  "--no-default-browser-check",
];

/**
 * Merge and dedupe browser arguments while preserving order.
 */
function mergeArgs(...argSets: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const args of argSets) {
    if (!args) continue;
    for (const arg of args) {
      if (typeof arg === "string" && !seen.has(arg)) {
        seen.add(arg);
        result.push(arg);
      }
    }
  }
  return result;
}

async function createBrowser(): Promise<import("puppeteer-core").Browser> {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    // Vercel: use @sparticuz/chromium + puppeteer-core
    const chromium = (await import("@sparticuz/chromium")).default;
    const { launch } = await import("puppeteer-core");
    const executablePath = await chromium.executablePath();

    const baseArgs = Array.isArray(chromium.args) ? chromium.args : [];

    return launch({
      headless: true,
      args: mergeArgs(baseArgs, STABILITY_ARGS),
      executablePath,
      defaultViewport: null,
    });
  }

  // Local development: prefer full puppeteer (bundled Chromium) if available,
  // otherwise fall back to puppeteer-core with a provided executable path.
  try {
    // Attempt to use full puppeteer locally for convenience
    const puppeteer = await import("puppeteer");

    const browser = await puppeteer.launch({
      headless: true,
      args: mergeArgs(STABILITY_ARGS),
      defaultViewport: null,
    });
    return browser;
  } catch {
    // Fallback: require an explicit executable path for a locally installed Chrome/Chromium
    const { launch } = await import("puppeteer-core");
    const executablePath =
      (process.env.PUPPETEER_EXECUTABLE_PATH && String(process.env.PUPPETEER_EXECUTABLE_PATH)) ||
      (process.env.CHROME_EXECUTABLE_PATH && String(process.env.CHROME_EXECUTABLE_PATH)) ||
      undefined;

    if (!executablePath) {
      throw new Error(
        "Missing PUPPETEER_EXECUTABLE_PATH for local Chrome/Chromium. Install 'puppeteer' or set the env var.",
      );
    }

    return launch({
      headless: true,
      args: mergeArgs(STABILITY_ARGS),
      executablePath,
      defaultViewport: null,
    });
  }
}

/**
 * Get a browser instance. Reuses existing instance if available.
 * Browser configuration is determined by environment (Vercel vs local).
 */
export async function getBrowser(): Promise<import("puppeteer-core").Browser> {
  if (closingPromise) await closingPromise;

  if (browserPromise) {
    const cachedPromise = browserPromise;
    try {
      const browser = await cachedPromise;
      if (browserPromise !== cachedPromise) return getBrowser();
      if (browser.connected) {
        return browser;
      }
      // Crashed/disconnected mid-use — relaunch instead of reusing it.
    } catch {
      if (browserPromise !== cachedPromise) return getBrowser();
    }
    browserPromise = null;
  }

  const launchPromise = createBrowser().catch((err) => {
    logger.error(err, "failed to create browser");
    // Reset promise to allow retry on next call
    if (browserPromise === launchPromise) browserPromise = null;
    throw err;
  });
  browserPromise = launchPromise;
  return launchPromise;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (closingPromise) return closingPromise;
  if (!browserPromise) {
    return;
  }

  const cachedPromise = browserPromise;
  browserPromise = null;
  try {
    closingPromise = (async () => {
      try {
        const browser = await cachedPromise;
        await browser.close();
      } catch (err) {
        logger.warn(err, "failed to close browser");
      } finally {
        if (browserPromise === cachedPromise) browserPromise = null;
      }
    })();
    await closingPromise;
  } finally {
    closingPromise = null;
  }
}

// Register shutdown handlers to close browser gracefully
// Note: We do NOT call process.exit() here - that's the application's responsibility
if (process.env.NODE_ENV !== "test") {
  const handleShutdown = (signal: string) => {
    logger.debug(`received ${signal}, closing browser`);
    void closeBrowser();
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

export type { Browser, Page } from "puppeteer-core";
