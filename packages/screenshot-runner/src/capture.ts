import { stat } from "node:fs/promises";

import puppeteer, { type Browser, type Page } from "puppeteer";

import { type AdblockStatus, enableAdBlocking } from "./adblock.ts";
import { type CaptureArguments, parseArguments, safeFinalUrl, validateUrl } from "./args.ts";
import { classifyError, RunnerError } from "./errors.ts";

const NAVIGATION_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_TIMEOUT_MS = 2_000;
const NETWORK_IDLE_TIME_MS = 500;
// Puppeteer's CDP calls (screenshot, close) otherwise wait 180 s on a busy renderer.
const PROTOCOL_TIMEOUT_MS = 10_000;
// The sandbox kills the command at 30 s (packages/screenshot/src/sandbox.ts); report first.
const RUN_DEADLINE_MS = 25_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
// --no-sandbox is never added: the page being rendered is attacker-supplied,
// so a launch failure must surface rather than silently downgrade isolation.
const LAUNCH_ARGS = ["--disable-dev-shm-usage", "--no-default-browser-check", "--no-first-run"];
const CHROMIUM_PATH = "/usr/bin/chromium";
// uid and gid of the image's `runner` user (see Dockerfile).
const RUNNER_ID = 10042;

/**
 * Vercel Sandbox doesn't document whether it honours the image's USER.
 * Chromium won't start its sandbox as root and --no-sandbox is never
 * passed, so a root start drops to the runner user first.
 */
function dropRootPrivileges(): void {
  if (process.getuid?.() !== 0) return;
  try {
    process.setgroups?.([]);
    process.setgid?.(RUNNER_ID);
    process.setuid?.(RUNNER_ID);
  } catch (error) {
    throw new RunnerError("browser_crash", "Could not drop root privileges", { cause: error });
  }
  process.env.HOME = "/home/runner";
}

// Checked before rendering, since a full-page capture allocates width x
// height x 4 bytes up front — the byte limit below only catches this after
// the fact.
const MAX_OUTPUT_PIXELS = 64_000_000;

let reported = false;
function report(result: Record<string, unknown>, exitCode: number): void {
  if (reported) return;
  reported = true;
  console.log(JSON.stringify(result));
  process.exitCode = exitCode;
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
  let browserVersion: string | null = null;
  let dimensions: { width: number; height: number } | null = null;
  let failure: unknown;

  setTimeout(() => {
    report(
      {
        success: false,
        width: null,
        height: null,
        finalUrl,
        adblock,
        browserVersion,
        durationMs: Date.now() - startedAt,
        errorCode: "timeout",
      },
      1,
    );
    process.exit();
  }, RUN_DEADLINE_MS).unref();

  try {
    dropRootPrivileges();
    args = parseArguments(process.argv.slice(2));
    const url = validateUrl(args.url);

    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      pipe: true,
      args: LAUNCH_ARGS,
      protocolTimeout: PROTOCOL_TIMEOUT_MS,
    });
    // Reported, not asserted: the version is a property of the image digest.
    browserVersion = await browser.version();

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

    // Re-checked: the page may have navigated again while settling.
    finalUrl = safeFinalUrl(page.url()) ?? finalUrl;
    validateUrl(page.url());

    // A full-page capture is taller than the viewport, so measure the document.
    dimensions = args.fullPage
      ? await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }))
      : { width: args.width, height: args.height };

    if (dimensions.width * dimensions.height > MAX_OUTPUT_PIXELS) {
      throw new RunnerError(
        "output_too_large",
        `Capture would be ${dimensions.width}x${dimensions.height} pixels`,
      );
    }

    await page.screenshot({
      type: args.format,
      fullPage: args.fullPage,
      path: args.output,
    });

    // Checked here so an oversized image is never transferred out of the sandbox.
    const { size } = await stat(args.output);
    if (size === 0) {
      throw new RunnerError("capture_failed", "Screenshot produced an empty file");
    }
    if (size > MAX_OUTPUT_BYTES) {
      throw new RunnerError("output_too_large", `Screenshot is ${size} bytes`);
    }
  } catch (error) {
    failure = error;
  }

  // Reported before cleanup: a hung browser.close() must not hide a finished capture
  // (the deadline timer exits the process with the result already printed).
  if (failure || !args || !dimensions) {
    report(
      {
        success: false,
        width: null,
        height: null,
        finalUrl,
        adblock,
        browserVersion,
        durationMs: Date.now() - startedAt,
        errorCode: classifyError(failure),
      },
      1,
    );
  } else {
    report(
      {
        success: true,
        width: dimensions.width,
        height: dimensions.height,
        finalUrl,
        adblock,
        browserVersion,
        durationMs: Date.now() - startedAt,
        errorCode: null,
      },
      0,
    );
  }

  await closeResources(page, browser);
}

await main();
