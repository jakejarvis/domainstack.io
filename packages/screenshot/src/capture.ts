import { createLogger } from "@domainstack/logger";
import { type Browser, getBrowser, type Page } from "./browser";
import { createPage } from "./page";

const logger = createLogger({ source: "screenshot/capture" });

const DEFAULT_VIEWPORT_WIDTH = 1200;
const DEFAULT_VIEWPORT_HEIGHT = 630;

export interface CaptureOptions {
  /** Viewport width in pixels */
  width?: number;
  /** Viewport height in pixels */
  height?: number;
  /** Screenshot format */
  format?: "webp" | "png" | "jpeg";
  /** Whether to capture full page */
  fullPage?: boolean;
}

export interface CaptureResult {
  /** Screenshot buffer */
  buffer: Buffer;
  /** Width of the captured screenshot */
  width: number;
  /** Height of the captured screenshot */
  height: number;
}

/**
 * Capture a screenshot of a URL.
 * Handles browser lifecycle and page creation.
 */
export async function captureScreenshot(
  url: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const {
    width = DEFAULT_VIEWPORT_WIDTH,
    height = DEFAULT_VIEWPORT_HEIGHT,
    format = "webp",
    fullPage = false,
  } = options;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await getBrowser();

    page = await createPage(browser, url, {
      viewport: { width, height },
    });

    if (!page) {
      throw new Error("Failed to create page");
    }

    const buffer = await page.screenshot({
      type: format,
      fullPage,
      encoding: "binary",
    });

    return {
      buffer: Buffer.from(buffer),
      width,
      height,
    };
  } catch (err) {
    logger.error(err, "screenshot capture failed");
    throw err;
  } finally {
    // Close page in background to avoid blocking
    void page?.close();
  }
}

/**
 * Capture a screenshot and return as base64.
 * Useful for serialization between workflow steps.
 */
export async function captureScreenshotBase64(
  url: string,
  options: CaptureOptions = {},
): Promise<{ imageBase64: string; width: number; height: number }> {
  const result = await captureScreenshot(url, options);
  return {
    imageBase64: result.buffer.toString("base64"),
    width: result.width,
    height: result.height,
  };
}
