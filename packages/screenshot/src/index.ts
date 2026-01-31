// Browser management
export { type Browser, closeBrowser, getBrowser, type Page } from "./browser";
// Screenshot capture
export {
  type CaptureOptions,
  type CaptureResult,
  captureScreenshot,
  captureScreenshotBase64,
} from "./capture";
// Page creation
export { type CreatePageOptions, createPage } from "./page";
