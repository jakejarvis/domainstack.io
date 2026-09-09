import { stat } from "node:fs/promises";

import puppeteer, { type Browser, type Page } from "puppeteer";

import { type AdblockStatus, enableAdBlocking } from "./adblock.js";
import { type CaptureArguments, parseArguments, safeFinalUrl, validateUrl } from "./args.js";
import { classifyError, RunnerError } from "./errors.js";

/**
 * `enabled` uses Chromium's own sandbox, which needs unprivileged user
 * namespaces. Where the host does not provide them Chromium refuses to start,
 * so the runner falls back to `disabled` rather than failing every capture; the
 * Sandbox microVM remains the real isolation boundary either way.
 */
type ChromiumSandboxStatus = "enabled" | "disabled";

const NAVIGATION_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_TIMEOUT_MS = 2_000;
const NETWORK_IDLE_TIME_MS = 500;
const CHROMIUM_VERSION = "149.0.7827.22";
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const LAUNCH_ARGS = ["--disable-dev-shm-usage", "--no-default-browser-check", "--no-first-run"];

async function launchBrowser(): Promise<{ browser: Browser; sandbox: ChromiumSandboxStatus }> {
  try {
    return {
      browser: await puppeteer.launch({ headless: true, args: LAUNCH_ARGS }),
      sandbox: "enabled",
    };
  } catch (error) {
    try {
      return {
        browser: await puppeteer.launch({ headless: true, args: [...LAUNCH_ARGS, "--no-sandbox"] }),
        sandbox: "disabled",
      };
    } catch {
      // Report the sandboxed failure: the fallback failing too means the cause
      // was never the sandbox.
      throw error;
    }
  }
}

async function closeResources(page: Page | null, browser: Browser | null): Promise<void> {
  if (page) {
    try {
      await page.close();
    } catch {}
  }
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  let page: Page | null = null;
  let browser: Browser | null = null;
  let args: CaptureArguments | null = null;
  let finalUrl: string | null = null;
  let adblock: AdblockStatus = "skipped";
  let chromiumSandbox: ChromiumSandboxStatus | null = null;
  let dimensions: { width: number; height: number } | null = null;
  let failure: unknown;

  try {
    args = parseArguments(process.argv.slice(2));
    const url = validateUrl(args.url);

    const launched = await launchBrowser();
    browser = launched.browser;
    chromiumSandbox = launched.sandbox;

    const browserVersion = await browser.version();
    if (!browserVersion.includes(CHROMIUM_VERSION)) {
      // A mismatched image stays broken until it is republished, so this must
      // not be reported as a transient failure the caller retries.
      throw new RunnerError(
        "configuration_error",
        `Expected Chromium ${CHROMIUM_VERSION} but the image provides ${browserVersion}`,
      );
    }

    page = await browser.newPage();
    await page.setViewport({ width: args.width, height: args.height, deviceScaleFactor: 1 });

    adblock = await enableAdBlocking(page);

    const response = await page.goto(url.href, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    finalUrl = safeFinalUrl(page.url()) ?? url.href;
    validateUrl(page.url());
    if (response && (response.status() === 429 || response.status() >= 500)) {
      throw new RunnerError(
        "upstream_temporary",
        `Temporary upstream response ${response.status()}`,
      );
    }

    try {
      await page.waitForNetworkIdle({
        idleTime: NETWORK_IDLE_TIME_MS,
        timeout: NETWORK_IDLE_TIMEOUT_MS,
      });
    } catch {}

    // The page may have navigated again while settling, so the scheme is
    // re-checked against the URL that is actually about to be captured.
    finalUrl = safeFinalUrl(page.url()) ?? finalUrl;
    validateUrl(page.url());

    // A full-page capture is as tall as the document, so reporting the viewport
    // height would misdescribe the image.
    dimensions = args.fullPage
      ? await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }))
      : { width: args.width, height: args.height };

    await page.screenshot({
      type: args.format,
      fullPage: args.fullPage,
      path: args.output,
    });

    // Checked here so an oversized image is never transferred out of the
    // sandbox only to be rejected by the caller.
    const { size } = await stat(args.output);
    if (size === 0) {
      throw new RunnerError("capture_failed", "Screenshot produced an empty file");
    }
    if (size > MAX_OUTPUT_BYTES) {
      throw new RunnerError("output_too_large", `Screenshot is ${size} bytes`);
    }
  } catch (error) {
    failure = error;
  } finally {
    await closeResources(page, browser);
  }

  if (failure || !args || !dimensions) {
    console.log(
      JSON.stringify({
        success: false,
        width: null,
        height: null,
        finalUrl,
        adblock,
        chromiumSandbox,
        durationMs: Date.now() - startedAt,
        errorCode: classifyError(failure),
      }),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify({
      success: true,
      width: dimensions.width,
      height: dimensions.height,
      finalUrl,
      adblock,
      chromiumSandbox,
      durationMs: Date.now() - startedAt,
      errorCode: null,
    }),
  );
}

await main();
