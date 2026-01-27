import * as ipaddr from "ipaddr.js";
import { withTimeout } from "@/lib/async";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { createLogger } from "@/lib/logger/server";
import { dohLookup } from "@/lib/resolver";

const logger = createLogger({ source: "safe-fetch" });

// Hosts that should never be fetched regardless of DNS (fast path).
const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

// Sensible defaults; callers can override per-use.
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;

/**
 * Options for safeFetch.
 *
 * Note: Retry logic is intentionally NOT included here. When used in workflow
 * steps, the workflow SDK handles retries via error classification (FatalError
 * vs RetryableError). For non-workflow code that needs retries, wrap the call
 * with `withRetry` from `@/lib/async`.
 */
interface BaseSafeFetchOptions {
  /** Absolute URL, or relative to `currentUrl` when provided. */
  url: string | URL;
  /** Optional base URL used to resolve relative `url` values. */
  currentUrl?: string | URL;
  /** Additional headers (e.g., `User-Agent`). */
  headers?: HeadersInit;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Maximum bytes to buffer before aborting (or truncating if truncateOnLimit is true). */
  maxBytes?: number;
  /** Maximum redirects we will follow while re-checking the host. */
  maxRedirects?: number;
  /** Additional allow list to further restrict hosts (still subject to default blocklist). */
  allowedHosts?: string[];
  /** Allow HTTP (useful for favicons); defaults to HTTPS only. */
  allowHttp?: boolean;
  /** If true, return truncated content instead of throwing when maxBytes is exceeded. Useful for HTML parsing. */
  truncateOnLimit?: boolean;
  /** If true, return the redirect response (3xx) instead of throwing if the redirect target is not in allowedHosts. */
  returnOnDisallowedRedirect?: boolean;
}

type SafeFetchOptionsWithGet = BaseSafeFetchOptions & {
  /** HTTP method to use (defaults to GET). */
  method?: "GET";
};

type SafeFetchOptionsWithHead = BaseSafeFetchOptions & {
  /** HTTP method to use. */
  method: "HEAD";
  /** If true, automatically retry with GET when HEAD fails with 405 (Method Not Allowed). */
  fallbackToGetOnHeadFailure?: boolean;
};

export type SafeFetchOptions =
  | SafeFetchOptionsWithGet
  | SafeFetchOptionsWithHead;

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string | null;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
}

type SafeFetchErrorCode =
  | "invalid_url"
  | "protocol_not_allowed"
  | "host_not_allowed"
  | "host_blocked"
  | "dns_error"
  | "private_ip"
  | "redirect_limit"
  | "invalid_response"
  | "size_exceeded";

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

/**
 * Fetch a user-controlled asset while protecting against SSRF, redirect-based
 * host swapping, and unbounded memory usage.
 *
 * This function provides:
 * - SSRF protection (blocks private IPs, validates DNS resolution)
 * - Redirect following with host validation at each hop
 * - Timeout handling per request
 * - Byte limit enforcement (with optional truncation)
 *
 * Retry logic is intentionally NOT included. When used in workflow steps,
 * throw FatalError or RetryableError based on the SafeFetchError code
 * (see `lib/workflow/errors.ts` for classification helpers). For non-workflow
 * code, wrap with `withRetry` from `@/lib/async` if needed.
 */
export async function safeFetch(
  opts: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const initialUrl = toUrl(opts.url, opts.currentUrl);
  let method = opts.method ?? "GET";
  let retryingWithGet = false;

  let currentUrl = initialUrl;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowHttp = opts.allowHttp ?? false;
  const truncateOnLimit = opts.truncateOnLimit ?? false;
  const fallbackToGetOnHeadFailure =
    opts.method === "HEAD" ? (opts.fallbackToGetOnHeadFailure ?? false) : false;
  const allowedHosts =
    opts.allowedHosts
      ?.map((host) => host.trim().toLowerCase())
      .filter(Boolean) ?? [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    // Treat every hop (including the initial request) as untrusted and re-run
    // the hostname/IP vetting so redirects cannot smuggle us into a private net.
    await ensureUrlAllowed(currentUrl, { allowHttp, allowedHosts });

    const response = await withTimeout(
      (signal) =>
        fetch(currentUrl.toString(), {
          method,
          headers: {
            "User-Agent":
              process.env.EXTERNAL_USER_AGENT ||
              "domainstack.io/0.1 (+https://domainstack.io)",
            ...normalizeHeaders(opts.headers),
          },
          redirect: "manual",
          signal,
        }),
      { timeoutMs },
    );

    if (isRedirect(response)) {
      if (redirectCount === maxRedirects) {
        throw new SafeFetchError(
          "redirect_limit",
          `Too many redirects fetching ${currentUrl.toString()}`,
        );
      }
      // Follow the Location manually so we can validate the next host ourselves.
      const location = response.headers.get("location");
      if (!location) {
        throw new SafeFetchError(
          "invalid_response",
          "Redirect response missing Location header",
        );
      }
      const nextUrl = new URL(location, currentUrl);

      // If strict allowedHosts is set, check if the next hop is allowed.
      // If not, and returnOnDisallowedRedirect is true, stop following and return the 3xx response.
      if (allowedHosts.length > 0) {
        const nextHost = nextUrl.hostname.trim().toLowerCase();
        if (
          !allowedHosts.includes(nextHost) &&
          opts.returnOnDisallowedRedirect
        ) {
          logger.debug(
            { from: currentUrl.toString(), to: nextUrl.toString() },
            "redirect to disallowed host, returning redirect response",
          );
          // Fall through to process this 3xx response as the final result
        } else {
          currentUrl = nextUrl;
          continue;
        }
      } else {
        currentUrl = nextUrl;
        continue;
      }
    }

    // If we got 405 on HEAD and fallback is enabled, retry with GET
    if (
      response.status === 405 &&
      method === "HEAD" &&
      fallbackToGetOnHeadFailure &&
      !retryingWithGet
    ) {
      logger.debug(
        { url: currentUrl.toString() },
        "HEAD returned 405, retrying with GET",
      );
      method = "GET";
      retryingWithGet = true;
      // Reset redirect count since we're starting over with GET
      redirectCount = -1; // Will be incremented to 0 on next loop iteration
      currentUrl = initialUrl; // Reset to initial URL
      continue;
    }

    // Non-2xx responses are valid HTTP responses - return them for caller to handle.
    // Only infrastructure errors (DNS, private IP, etc.) throw exceptions.

    // Check Content-Length header (skip pre-check if we'll truncate anyway)
    const declaredLength = response.headers.get("content-length");
    if (declaredLength && !truncateOnLimit) {
      const declared = Number(declaredLength);
      if (Number.isFinite(declared) && declared > maxBytes) {
        logger.debug(
          { url: currentUrl.toString(), declared, limit: maxBytes },
          "size exceeded",
        );
        const error = new SafeFetchError(
          "size_exceeded",
          `Remote asset declared size ${declared} exceeds limit ${maxBytes}`,
        );
        throw error;
      }
    }

    const buffer = await readBodyWithLimit(response, maxBytes, truncateOnLimit);
    const contentType = response.headers.get("content-type");
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });

    return {
      buffer,
      contentType,
      finalUrl: currentUrl.toString(),
      status: response.status,
      ok: response.ok,
      headers,
    };
  }

  // Safety fallback - should be unreachable given loop logic
  throw new SafeFetchError("redirect_limit", "Exceeded redirect limit");
}

function toUrl(input: string | URL, base?: string | URL): URL {
  if (input instanceof URL) return input;
  try {
    return base ? new URL(input, base) : new URL(input);
  } catch {
    throw new SafeFetchError("invalid_url", `Invalid URL: ${input}`);
  }
}

/**
 * Normalize headers from various formats to a plain object.
 */
function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, name) => {
      result[name] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers;
}

/**
 * Validate scheme + hostname, ensure DNS does not resolve to private ranges,
 * and respect the optional allow list.
 */
async function ensureUrlAllowed(
  url: URL,
  options: { allowHttp: boolean; allowedHosts: string[] },
) {
  const protocol = url.protocol.toLowerCase();
  // HTTPS is the default; only allow HTTP when explicitly opted-in.
  if (protocol !== "https:" && !(options.allowHttp && protocol === "http:")) {
    throw new SafeFetchError(
      "protocol_not_allowed",
      `Protocol ${protocol} not allowed`,
    );
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new SafeFetchError("invalid_url", "URL missing hostname");
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    logger.warn({ url: url.toString() }, "blocked host");
    throw new SafeFetchError("host_blocked", `Host ${hostname} is blocked`);
  }

  if (
    options.allowedHosts.length > 0 &&
    !options.allowedHosts.includes(hostname)
  ) {
    logger.warn({ url: url.toString() }, "blocked host");
    throw new SafeFetchError(
      "host_not_allowed",
      `Host ${hostname} is not in allow list`,
    );
  }

  if (ipaddr.isValid(hostname)) {
    if (isBlockedIp(hostname)) {
      logger.warn({ url: url.toString() }, "blocked private ip");
      throw new SafeFetchError("private_ip", `IP ${hostname} is not reachable`);
    }
    return;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    // Use DoH-based DNS lookup to avoid blocking Node.js threadpool.
    // This prevents EBUSY errors under high concurrency.
    const result = await dohLookup(hostname, { all: true });
    records = Array.isArray(result) ? result : [result];
  } catch (err) {
    // DNS failures are expected for non-existent domains - log at info level
    // since the caller will gracefully fall back to a placeholder
    if (!isExpectedDnsError(err)) {
      logger.warn({
        err,
        url: url.toString(),
      });
    }
    throw new SafeFetchError(
      "dns_error",
      err instanceof Error ? err.message : "DNS lookup failed",
    );
  }

  if (!records || records.length === 0) {
    logger.debug({ url: url.toString() }, "lookup returned no records");
    throw new SafeFetchError("dns_error", "DNS lookup returned no records");
  }

  if (records.some((record) => isBlockedIp(record.address))) {
    logger.warn({ url: url.toString() }, "blocked private ip");
    throw new SafeFetchError(
      "private_ip",
      `DNS for ${hostname} resolved to private address`,
    );
  }
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

/**
 * Incrementally read the response body, aborting or truncating if it exceeds the byte limit.
 * @param truncateOnLimit If true, return partial content instead of throwing when limit is exceeded.
 */
async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  truncateOnLimit = false,
): Promise<Buffer> {
  if (!response.body) {
    // No stream available (tiny body or mocked response); a simple check suffices.
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      if (truncateOnLimit) {
        return buf.subarray(0, maxBytes);
      }
      throw new SafeFetchError(
        "size_exceeded",
        `Remote asset exceeded ${maxBytes} bytes`,
      );
    }
    return buf;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        // Add the partial chunk up to the limit
        const overage = received - maxBytes;
        const partialChunk = Buffer.from(value).subarray(
          0,
          value.byteLength - overage,
        );
        if (partialChunk.length > 0) {
          chunks.push(partialChunk);
        }

        try {
          reader.cancel();
        } catch {
          // ignore
        }

        if (truncateOnLimit) {
          // Return what we have so far (truncated at maxBytes)
          return Buffer.concat(chunks, maxBytes);
        }

        // Abort as soon as the limit is crossed to avoid buffering unbounded data.
        throw new SafeFetchError(
          "size_exceeded",
          `Remote asset exceeded ${maxBytes} bytes`,
        );
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks, received);
}

function isBlockedIp(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    const range = parsed.range();
    return range !== "unicast";
  } catch {
    return true;
  }
}
