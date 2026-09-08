import puppeteer, { type Browser, type Page } from "puppeteer";

import { type AdblockStatus, enableAdBlocking } from "./adblock.js";

type ImageFormat = "webp" | "png" | "jpeg";

type RunnerErrorCode =
  | "browser_crash"
  | "capture_failed"
  | "connection_reset"
  | "dns_error"
  | "invalid_arguments"
  | "invalid_url"
  | "timeout"
  | "tls_error"
  | "upstream_temporary";

interface CaptureArguments {
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
  output: string;
  fullPage: boolean;
}

const NAVIGATION_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_TIMEOUT_MS = 2_000;
const NETWORK_IDLE_TIME_MS = 500;
const CHROMIUM_VERSION = "149.0.7827.22";

function parseArguments(argv: string[]): CaptureArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Arguments must be provided as named key/value pairs");
    }
    values.set(key.slice(2), value);
  }

  const url = values.get("url");
  const output = values.get("output");
  const format = values.get("format");
  const width = Number(values.get("width"));
  const height = Number(values.get("height"));
  const fullPage = values.get("full-page") === "true";
  if (
    !url ||
    !output ||
    !format ||
    !["webp", "png", "jpeg"].includes(format) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 7680 ||
    height > 4320
  ) {
    throw new Error("Missing or invalid capture arguments");
  }

  return { url, width, height, format: format as ImageFormat, output, fullPage };
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only credential-free HTTPS URLs are supported");
  }
  return url;
}

function safeFinalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function classifyError(error: unknown, argumentPhase: boolean): RunnerErrorCode {
  if (argumentPhase) return "invalid_arguments";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid url") || message.includes("https urls")) return "invalid_url";
  if (message.includes("err_name_not_resolved") || message.includes("enotfound"))
    return "dns_error";
  if (
    message.includes("certificate") ||
    message.includes("ssl") ||
    message.includes("tls") ||
    message.includes("err_cert")
  ) {
    return "tls_error";
  }
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("connection reset") ||
    message.includes("err_connection")
  ) {
    return "connection_reset";
  }
  if (
    message.includes("target closed") ||
    message.includes("browser has disconnected") ||
    message.includes("failed to launch the browser process")
  ) {
    return "browser_crash";
  }
  if (message.includes("429") || /\b5\d\d\b/.test(message)) return "upstream_temporary";
  return "capture_failed";
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
  let failure: unknown;
  let argumentPhase = true;

  try {
    args = parseArguments(process.argv.slice(2));
    const url = validateUrl(args.url);
    argumentPhase = false;

    browser = await puppeteer.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-default-browser-check", "--no-first-run"],
    });
    const browserVersion = await browser.version();
    if (!browserVersion.includes(CHROMIUM_VERSION)) {
      throw new Error("Pinned Chromium version is unavailable");
    }

    page = await browser.newPage();
    await page.setViewport({ width: args.width, height: args.height, deviceScaleFactor: 1 });

    adblock = await enableAdBlocking(page);

    const response = await page.goto(url.href, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    finalUrl = safeFinalUrl(page.url()) ?? url.href;
    if (new URL(page.url()).protocol !== "https:") {
      throw new Error("Only HTTPS URLs are supported after redirects");
    }
    if (response && (response.status() === 429 || response.status() >= 500)) {
      throw new Error(`Temporary upstream response ${response.status()}`);
    }

    try {
      await page.waitForNetworkIdle({
        idleTime: NETWORK_IDLE_TIME_MS,
        timeout: NETWORK_IDLE_TIMEOUT_MS,
      });
    } catch {}

    await page.screenshot({
      type: args.format,
      fullPage: args.fullPage,
      path: args.output,
    });
  } catch (error) {
    failure = error;
  } finally {
    await closeResources(page, browser);
  }

  if (failure || !args) {
    console.log(
      JSON.stringify({
        success: false,
        width: null,
        height: null,
        finalUrl,
        adblock,
        durationMs: Date.now() - startedAt,
        errorCode: classifyError(failure, argumentPhase),
      }),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify({
      success: true,
      width: args.width,
      height: args.height,
      finalUrl,
      adblock,
      durationMs: Date.now() - startedAt,
      errorCode: null,
    }),
  );
}

await main();
