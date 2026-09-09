import { RunnerError } from "./errors.js";

export type ImageFormat = "webp" | "png" | "jpeg";

export interface CaptureArguments {
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
  output: string;
  fullPage: boolean;
}

const IMAGE_FORMATS = new Set<ImageFormat>(["webp", "png", "jpeg"]);
const OPTIONS = new Set(["url", "width", "height", "format", "output", "full-page"]);
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;

export function parseArguments(argv: string[]): CaptureArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new RunnerError(
        "invalid_arguments",
        "Arguments must be provided as named key/value pairs",
      );
    }
    const name = key.slice(2);
    // A misspelled option would otherwise be dropped, silently capturing
    // something other than what the caller asked for.
    if (!OPTIONS.has(name)) {
      throw new RunnerError("invalid_arguments", `Unknown option --${name}`);
    }
    values.set(name, value);
  }

  const url = values.get("url");
  const output = values.get("output");
  const format = values.get("format");
  const width = Number(values.get("width"));
  const height = Number(values.get("height"));
  const fullPageValue = values.get("full-page");
  if (fullPageValue !== "true" && fullPageValue !== "false") {
    throw new RunnerError("invalid_arguments", "--full-page must be true or false");
  }
  const fullPage = fullPageValue === "true";
  if (
    !url ||
    !output ||
    !format ||
    !IMAGE_FORMATS.has(format as ImageFormat) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_WIDTH ||
    height > MAX_HEIGHT
  ) {
    throw new RunnerError("invalid_arguments", "Missing or invalid capture arguments");
  }

  return { url, width, height, format: format as ImageFormat, output, fullPage };
}

/**
 * Applied before navigating and again before capturing, since a page can send
 * itself to a weaker scheme after the initial load settles.
 */
export function validateUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new RunnerError("invalid_url", "Screenshot target is not a valid URL", { cause: error });
  }
  if (url.protocol !== "https:") {
    throw new RunnerError("invalid_url", "Only HTTPS URLs are supported");
  }
  if (url.username || url.password) {
    throw new RunnerError("invalid_url", "Screenshot target must not contain credentials");
  }
  return url;
}

/** Strips credentials and query so a redirect target is safe to log. */
export function safeFinalUrl(value: string | undefined): string | null {
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
