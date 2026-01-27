import * as ipaddr from "ipaddr.js";
import { isExpectedDnsError, resolveHostIps } from "./dns";
import { SafeFetchError } from "./errors";
import { isPrivateIp } from "./ip";
import type {
  SafeFetchLogger,
  SafeFetchOptions,
  SafeFetchResult,
} from "./types";
import { withTimeout } from "./utils";

/** Default console logger */
const consoleLogger: SafeFetchLogger = {
  debug: (obj, msg) => console.debug(msg, obj),
  info: (obj, msg) => console.info(msg, obj),
  warn: (obj, msg) => console.warn(msg, obj),
  error: (obj, msg) => console.error(msg, obj),
};

// Hostnames that should never be fetched
const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

// Defaults
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;

/**
 * Fetch a URL with SSRF protection, redirect validation, and size limits.
 *
 * Protects against:
 * - SSRF attacks (blocks private IPs, validates DNS resolution)
 * - Redirect-based host swapping (validates each hop)
 * - Unbounded memory usage (enforces size limits)
 *
 * HTTP errors (4xx, 5xx) are returned as successful responses.
 * Only infrastructure errors throw SafeFetchError.
 */
export async function safeFetch(
  opts: SafeFetchOptions,
): Promise<SafeFetchResult> {
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
    logger = consoleLogger,
  } = opts;

  const initialUrl = toUrl(opts.url, opts.currentUrl);
  let currentUrl = initialUrl;
  let method: "GET" | "HEAD" = opts.method ?? "GET";
  let retryingWithGet = false;

  const normalizedAllowedHosts =
    allowedHosts?.map((h) => h.trim().toLowerCase()).filter(Boolean) ?? [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    // Validate every hop (including initial) to prevent SSRF via redirects
    await ensureUrlAllowed(currentUrl, {
      allowHttp,
      allowedHosts: normalizedAllowedHosts,
      userAgent,
      logger,
    });

    const response = await withTimeout(
      (signal) =>
        customFetch(currentUrl.toString(), {
          method,
          headers: {
            ...(userAgent ? { "User-Agent": userAgent } : {}),
            ...opts.headers,
          },
          redirect: "manual",
          signal,
        }),
      timeoutMs,
    );

    // Handle redirects
    if (isRedirect(response)) {
      if (redirectCount === maxRedirects) {
        throw new SafeFetchError(
          "redirect_limit",
          `Too many redirects fetching ${currentUrl}`,
        );
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new SafeFetchError(
          "invalid_response",
          "Redirect response missing Location header",
        );
      }

      const nextUrl = new URL(location, currentUrl);

      logger.debug(
        {
          from: currentUrl.toString(),
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
            return buildResult(response, currentUrl, maxBytes, truncateOnLimit);
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
      logger.debug(
        { url: currentUrl.toString() },
        "HEAD returned 405, retrying with GET",
      );
      method = "GET";
      retryingWithGet = true;
      currentUrl = initialUrl;
      redirectCount = -1;
      continue;
    }

    return buildResult(response, currentUrl, maxBytes, truncateOnLimit);
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

async function ensureUrlAllowed(
  url: URL,
  opts: {
    allowHttp: boolean;
    allowedHosts: string[];
    userAgent: string | null | undefined;
    logger: SafeFetchLogger;
  },
): Promise<void> {
  const { logger } = opts;
  const protocol = url.protocol.toLowerCase();

  // Protocol check
  if (protocol !== "https:" && !(opts.allowHttp && protocol === "http:")) {
    throw new SafeFetchError(
      "protocol_not_allowed",
      `Protocol ${protocol} not allowed`,
    );
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new SafeFetchError("invalid_url", "URL missing hostname");
  }

  // Blocked hostnames
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))
  ) {
    throw new SafeFetchError("host_blocked", `Host ${hostname} is blocked`);
  }

  // Allowlist check
  if (opts.allowedHosts.length > 0 && !opts.allowedHosts.includes(hostname)) {
    throw new SafeFetchError(
      "host_not_allowed",
      `Host ${hostname} is not in allow list`,
    );
  }

  // If hostname is already an IP, check it directly
  if (ipaddr.isValid(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SafeFetchError("private_ip", `IP ${hostname} is not reachable`);
    }
    return;
  }

  // DNS lookup to check resolved IPs
  let records: Array<{ address: string }>;
  try {
    const result = await resolveHostIps(hostname, {
      userAgent: opts.userAgent,
      all: true,
    });

    records = Array.isArray(result) ? result : [result];
  } catch (err) {
    logger.warn({ hostname, err }, "DNS lookup failed");
    const message = isExpectedDnsError(err)
      ? "DNS lookup returned no records"
      : err instanceof Error
        ? err.message
        : "DNS lookup failed";
    throw new SafeFetchError("dns_error", message);
  }

  if (records.length === 0) {
    throw new SafeFetchError("dns_error", "DNS lookup returned no records");
  }

  // Check if any resolved IP is private
  if (records.some((r) => isPrivateIp(r.address))) {
    throw new SafeFetchError(
      "private_ip",
      `DNS for ${hostname} resolved to private address`,
    );
  }
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

  const buffer = await readBodyWithLimit(response, maxBytes, truncateOnLimit);
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
): Promise<Buffer> {
  if (!response.body) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      if (truncateOnLimit) return buf.subarray(0, maxBytes);
      throw new SafeFetchError(
        "size_exceeded",
        `Response exceeded ${maxBytes} bytes`,
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
        const overage = received - maxBytes;
        const partial = Buffer.from(value).subarray(
          0,
          value.byteLength - overage,
        );
        if (partial.length > 0) chunks.push(partial);

        try {
          reader.cancel();
        } catch {
          // Ignore cancel errors
        }

        if (truncateOnLimit) {
          return Buffer.concat(chunks, maxBytes);
        }

        throw new SafeFetchError(
          "size_exceeded",
          `Response exceeded ${maxBytes} bytes`,
        );
      }

      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks, received);
}
