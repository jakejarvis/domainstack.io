import { lookup as dnsLookup } from "node:dns/promises";
import * as ipaddr from "ipaddr.js";
import { USER_AGENT } from "@/lib/constants/app";
import { createLogger } from "@/lib/logger/server";
import { addSpanAttributes, withChildSpan } from "@/lib/tracing";

const logger = createLogger({ source: "remote-asset" });

// Hosts that should never be fetched regardless of DNS (fast path).
const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

// Sensible defaults; callers can override per-use.
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;

export type RemoteAssetErrorCode =
  | "invalid_url"
  | "protocol_not_allowed"
  | "host_not_allowed"
  | "host_blocked"
  | "dns_error"
  | "private_ip"
  | "redirect_limit"
  | "response_error"
  | "size_exceeded";

export class RemoteAssetError extends Error {
  constructor(
    public readonly code: RemoteAssetErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RemoteAssetError";
  }
}

export type FetchRemoteAssetOptions = {
  /** Absolute URL, or relative to `currentUrl` when provided. */
  url: string | URL;
  /** Optional base URL used to resolve relative `url` values. */
  currentUrl?: string | URL;
  /** Additional headers (e.g., `User-Agent`). */
  headers?: HeadersInit;
  /** Abort timeout per request/redirect hop (ms). */
  timeoutMs?: number;
  /** Maximum bytes to buffer before aborting. */
  maxBytes?: number;
  /** Maximum redirects we will follow while re-checking the host. */
  maxRedirects?: number;
  /** Additional allow list to further restrict hosts (still subject to default blocklist). */
  allowedHosts?: string[];
  /** Allow HTTP (useful for favicons); defaults to HTTPS only. */
  allowHttp?: boolean;
};

export type RemoteAssetResult = {
  buffer: Buffer;
  contentType: string | null;
  finalUrl: string;
  status: number;
};

/**
 * Fetch a user-controlled asset while protecting against SSRF, redirect-based
 * host swapping, and unbounded memory usage.
 */
export async function fetchRemoteAsset(
  opts: FetchRemoteAssetOptions,
): Promise<RemoteAssetResult> {
  const initialUrl = toUrl(opts.url, opts.currentUrl);

  return await withChildSpan(
    {
      name: "http.fetch_remote_asset",
      attributes: {
        "url.full": initialUrl.toString(),
        "url.scheme": initialUrl.protocol,
      },
    },
    async () => {
      let currentUrl = initialUrl;
      const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
      const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
      const allowHttp = opts.allowHttp ?? false;
      const allowedHosts =
        opts.allowedHosts
          ?.map((host) => host.trim().toLowerCase())
          .filter(Boolean) ?? [];

      addSpanAttributes({
        "http.timeout_ms": timeoutMs,
        "http.max_bytes": maxBytes,
        "http.max_redirects": maxRedirects,
        "http.allow_http": allowHttp,
      });

      for (
        let redirectCount = 0;
        redirectCount <= maxRedirects;
        redirectCount++
      ) {
        // Treat every hop (including the initial request) as untrusted and re-run
        // the hostname/IP vetting so redirects cannot smuggle us into a private net.
        await ensureUrlAllowed(currentUrl, { allowHttp, allowedHosts });

        const response = await timedFetch(currentUrl.toString(), {
          headers: opts.headers,
          timeoutMs,
        });

        if (isRedirect(response)) {
          if (redirectCount === maxRedirects) {
            addSpanAttributes({ "http.redirects_exceeded": true });
            throw new RemoteAssetError(
              "redirect_limit",
              `Too many redirects fetching ${currentUrl.toString()}`,
            );
          }
          // Follow the Location manually so we can validate the next host ourselves.
          const location = response.headers.get("location");
          if (!location) {
            throw new RemoteAssetError(
              "response_error",
              "Redirect response missing Location header",
            );
          }
          const nextUrl = new URL(location, currentUrl);
          currentUrl = nextUrl;
          continue;
        }

        if (!response.ok) {
          addSpanAttributes({
            "http.response.status_code": response.status,
            "http.error": true,
          });
          const error = new RemoteAssetError(
            "response_error",
            `Remote asset request failed with ${response.status}`,
            response.status,
          );
          logger.warn("response error", {
            url: currentUrl.toString(),
            reason: error.message,
          });
          throw error;
        }

        const declaredLength = response.headers.get("content-length");
        if (declaredLength) {
          const declared = Number(declaredLength);
          if (Number.isFinite(declared) && declared > maxBytes) {
            addSpanAttributes({
              "http.size_exceeded": true,
              "http.declared_size": declared,
            });
            const error = new RemoteAssetError(
              "size_exceeded",
              `Remote asset declared size ${declared} exceeds limit ${maxBytes}`,
            );
            logger.warn("size exceeded", {
              url: currentUrl.toString(),
              reason: error.message,
            });
            throw error;
          }
        }

        const buffer = await readBodyWithLimit(response, maxBytes);
        const contentType = response.headers.get("content-type");

        // Add success attributes
        addSpanAttributes({
          "http.response.status_code": response.status,
          "http.content_type": contentType ?? "unknown",
          "http.bytes_received": buffer.byteLength,
          ...(currentUrl.toString() !== initialUrl.toString() && {
            "http.final_url": currentUrl.toString(),
          }),
        });

        return {
          buffer,
          contentType,
          finalUrl: currentUrl.toString(),
          status: response.status,
        };
      }

      throw new RemoteAssetError("redirect_limit", "Exceeded redirect limit");
    },
  );
}

function toUrl(input: string | URL, base?: string | URL): URL {
  if (input instanceof URL) return input;
  try {
    return base ? new URL(input, base) : new URL(input);
  } catch {
    throw new RemoteAssetError("invalid_url", `Invalid URL: ${input}`);
  }
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
    throw new RemoteAssetError(
      "protocol_not_allowed",
      `Protocol ${protocol} not allowed`,
    );
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new RemoteAssetError("invalid_url", "URL missing hostname");
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    logger.warn("blocked host", {
      url: url.toString(),
    });
    throw new RemoteAssetError("host_blocked", `Host ${hostname} is blocked`);
  }

  if (
    options.allowedHosts.length > 0 &&
    !options.allowedHosts.includes(hostname)
  ) {
    logger.warn("blocked host", {
      url: url.toString(),
    });
    throw new RemoteAssetError(
      "host_not_allowed",
      `Host ${hostname} is not in allow list`,
    );
  }

  if (ipaddr.isValid(hostname)) {
    if (isBlockedIp(hostname)) {
      logger.warn("blocked private ip", {
        url: url.toString(),
      });
      throw new RemoteAssetError(
        "private_ip",
        `IP ${hostname} is not reachable`,
      );
    }
    return;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(hostname, { all: true });
  } catch (err) {
    logger.error("unexpected lookup error", err, {
      url: url.toString(),
    });
    throw new RemoteAssetError(
      "dns_error",
      err instanceof Error ? err.message : "DNS lookup failed",
    );
  }

  if (!records || records.length === 0) {
    logger.warn("lookup returned no records", {
      url: url.toString(),
    });
    throw new RemoteAssetError("dns_error", "DNS lookup returned no records");
  }

  if (records.some((record) => isBlockedIp(record.address))) {
    logger.warn("blocked private ip", {
      url: url.toString(),
    });
    throw new RemoteAssetError(
      "private_ip",
      `DNS for ${hostname} resolved to private address`,
    );
  }
}

/**
 * Wrapper around `fetch` that adds an AbortController/timeout per request.
 */
async function timedFetch(
  url: string,
  opts: { headers?: HeadersInit; timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        ...opts.headers,
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

/**
 * Incrementally read the response body, aborting if it exceeds the byte limit.
 */
async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  if (!response.body) {
    // No stream available (tiny body or mocked response); a simple check suffices.
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new RemoteAssetError(
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
        try {
          reader.cancel();
        } catch {
          // ignore
        }
        // Abort as soon as the limit is crossed to avoid buffering unbounded data.
        throw new RemoteAssetError(
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
