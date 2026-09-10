import { Agent } from "undici";

import { createLogger } from "@domainstack/logger";

import { SafeFetchError } from "./errors";
import type { ResolvedIp } from "./resolve";
import { createPinnedLookup, resolvePublicHost } from "./resolve";
import type { SafeFetchLogger, SafeFetchOptions, SafeFetchResult } from "./types";
import { withTimeout } from "./utils";

const defaultLogger = createLogger({ source: "safe-fetch" });

// Defaults
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;

/** Headers that must not follow a redirect to a different origin. */
const CREDENTIAL_HEADERS = new Set(["authorization", "cookie", "proxy-authorization"]);

/** `dispatcher` is an undici extension that the DOM `RequestInit` type omits. */
type FetchInit = RequestInit & { dispatcher?: Agent };

/**
 * Fetch a URL with SSRF protection, redirect validation, and size limits.
 *
 * Protects against:
 * - SSRF attacks (blocks private IPs, validates DNS resolution)
 * - DNS rebinding (connects only to the addresses that were validated)
 * - Redirect-based host swapping (validates each hop)
 * - Credential leaks across a cross-origin redirect
 * - Unbounded memory usage (enforces size limits)
 *
 * HTTP errors (4xx, 5xx) are returned as successful responses.
 * Only infrastructure errors throw SafeFetchError.
 */
export async function safeFetch(opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const {
    userAgent,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    allowHttp = false,
    truncateOnLimit = false,
    fallbackToGetOnHeadFailure = false,
    allowedHosts,
    returnOnDisallowedRedirect = false,
    fetch: customFetch = globalThis.fetch,
    logger = defaultLogger,
  } = opts;

  const initialUrl = toUrl(opts.url, opts.currentUrl);
  let currentUrl = initialUrl;
  let method: "GET" | "HEAD" = opts.method ?? "GET";
  let retryingWithGet = false;

  const baseHeaders: Record<string, string> = {
    ...(userAgent ? { "User-Agent": userAgent } : {}),
    ...opts.headers,
  };

  const normalizedAllowedHosts =
    allowedHosts?.map((h) => h.trim().toLowerCase()).filter(Boolean) ?? [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    // Validate every hop (including initial) to prevent SSRF via redirects
    const addresses = await ensureUrlAllowed(currentUrl, {
      allowHttp,
      allowedHosts: normalizedAllowedHosts,
      logger,
      timeoutMs,
    });

    // Pin the socket to the addresses we just validated so a second DNS answer
    // cannot point the connection at a private target (DNS rebinding). The
    // agent is per-request, so it is closed once the body has been read.
    const dispatcher = new Agent({ connect: { lookup: createPinnedLookup(addresses) } });
    const hopUrl = currentUrl;

    try {
      const response = await withTimeout(async (signal) => {
        try {
          return await customFetch(hopUrl.toString(), {
            method,
            headers: headersForHop(baseHeaders, initialUrl, hopUrl),
            redirect: "manual",
            signal,
            dispatcher,
          } satisfies FetchInit as RequestInit);
        } catch (err) {
          throw toTransportError(err, hopUrl);
        }
      }, timeoutMs);

      // Handle redirects
      if (isRedirect(response)) {
        if (redirectCount === maxRedirects) {
          throw new SafeFetchError("redirect_limit", `Too many redirects fetching ${hopUrl}`);
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new SafeFetchError("invalid_response", "Redirect response missing Location header");
        }

        const nextUrl = new URL(location, hopUrl);

        logger.debug(
          {
            from: hopUrl.toString(),
            to: nextUrl.toString(),
            status: response.status,
          },
          "following redirect",
        );

        // Check if redirect target is allowed
        if (normalizedAllowedHosts.length > 0) {
          const nextHost = nextUrl.hostname.trim().toLowerCase();
          if (!normalizedAllowedHosts.includes(nextHost)) {
            if (returnOnDisallowedRedirect) {
              // Return the redirect response as-is
              return await buildResult(response, hopUrl, maxBytes, truncateOnLimit);
            }
            // Otherwise continue to next iteration which will throw
          }
        }

        currentUrl = nextUrl;
        continue;
      }

      // Retry HEAD with GET if 405
      if (
        response.status === 405 &&
        method === "HEAD" &&
        fallbackToGetOnHeadFailure &&
        !retryingWithGet
      ) {
        logger.debug({ url: hopUrl.toString() }, "HEAD returned 405, retrying with GET");
        method = "GET";
        retryingWithGet = true;
        currentUrl = initialUrl;
        redirectCount = -1;
        continue;
      }

      return await buildResult(response, hopUrl, maxBytes, truncateOnLimit);
    } finally {
      void dispatcher.close().catch(() => {
        // Agent teardown failures are not actionable
      });
    }
  }

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
 * Drop credential headers once a redirect has taken us off the original origin.
 */
function headersForHop(
  baseHeaders: Record<string, string>,
  initialUrl: URL,
  currentUrl: URL,
): Record<string, string> {
  if (currentUrl.origin === initialUrl.origin) return baseHeaders;

  const safe: Record<string, string> = {};
  for (const [name, value] of Object.entries(baseHeaders)) {
    if (!CREDENTIAL_HEADERS.has(name.toLowerCase())) {
      safe[name] = value;
    }
  }
  return safe;
}

/**
 * Map a transport-level failure onto the documented SafeFetchError codes.
 */
function toTransportError(err: unknown, url: URL): SafeFetchError {
  if (err instanceof SafeFetchError) return err;

  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new SafeFetchError("timeout", `Request to ${url} timed out`);
  }

  const message = err instanceof Error ? err.message : String(err);
  return new SafeFetchError("connection_error", `Request to ${url} failed: ${message}`);
}

async function ensureUrlAllowed(
  url: URL,
  opts: {
    allowHttp: boolean;
    allowedHosts: string[];
    logger: SafeFetchLogger;
    timeoutMs: number;
  },
): Promise<ResolvedIp[]> {
  const { logger } = opts;
  const protocol = url.protocol.toLowerCase();

  // Protocol check
  if (protocol !== "https:" && !(opts.allowHttp && protocol === "http:")) {
    throw new SafeFetchError("protocol_not_allowed", `Protocol ${protocol} not allowed`);
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new SafeFetchError("invalid_url", "URL missing hostname");
  }

  // Allowlist check
  if (opts.allowedHosts.length > 0 && !opts.allowedHosts.includes(hostname)) {
    throw new SafeFetchError("host_not_allowed", `Host ${hostname} is not in allow list`);
  }

  // Resolve and reject blocked, private, reserved, and mixed public/private answers.
  return await resolvePublicHost(hostname, { timeoutMs: opts.timeoutMs, logger });
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

async function buildResult(
  response: Response,
  url: URL,
  maxBytes: number,
  truncateOnLimit: boolean,
): Promise<SafeFetchResult> {
  // Check Content-Length before downloading
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && !truncateOnLimit) {
    const declared = Number(declaredLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new SafeFetchError(
        "size_exceeded",
        `Response size ${declared} exceeds limit ${maxBytes}`,
      );
    }
  }

  const buffer = await readBodyWithLimit(response, maxBytes, truncateOnLimit, url);
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });

  return {
    buffer,
    contentType: response.headers.get("content-type"),
    finalUrl: url.toString(),
    status: response.status,
    ok: response.ok,
    headers,
  };
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  truncateOnLimit: boolean,
  url: URL,
): Promise<Buffer> {
  if (!response.body) {
    let buf: Buffer;
    try {
      buf = Buffer.from(await response.arrayBuffer());
    } catch (err) {
      throw toTransportError(err, url);
    }
    if (buf.byteLength > maxBytes) {
      if (truncateOnLimit) return buf.subarray(0, maxBytes);
      throw new SafeFetchError("size_exceeded", `Response exceeded ${maxBytes} bytes`);
    }
    return buf;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;

  while (true) {
    let done: boolean;
    let value: Uint8Array | undefined;
    try {
      ({ done, value } = await reader.read());
    } catch (err) {
      throw toTransportError(err, url);
    }
    if (done) break;

    if (value) {
      received += value.byteLength;

      if (received > maxBytes) {
        const overage = received - maxBytes;
        const partial = Buffer.from(value).subarray(0, value.byteLength - overage);
        if (partial.length > 0) chunks.push(partial);

        void reader.cancel().catch(() => {
          // Ignore cancel errors
        });

        if (truncateOnLimit) {
          return Buffer.concat(chunks, maxBytes);
        }

        throw new SafeFetchError("size_exceeded", `Response exceeded ${maxBytes} bytes`);
      }

      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks, received);
}
