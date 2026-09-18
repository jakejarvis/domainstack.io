/**
 * One HTML GET of a domain's homepage, shared by every service that needs the
 * page body.
 *
 * SEO needs the meta tags, technology detection needs the body, the response
 * headers and the cookies. Fetching 512 KB twice per cold report would be
 * wasteful, so concurrent callers share one request via `shareInFlight`.
 * This deduplicates concurrent work only — it is not a cache, and each
 * non-overlapping call fetches fresh.
 *
 * Permanent failures (DNS, TLS, non-2xx, non-HTML) come back as an `error`
 * field so callers can persist the failure. Transient failures throw
 * `RemoteDataUnavailableError`, matching every other service here.
 */

import { isExpectedDnsError, safeFetch } from "@domainstack/safe-fetch";

import { isExpectedTlsError } from "../tls";
import { RemoteDataUnavailableError } from "./fetch-errors";
import { shareInFlight } from "./in-flight";

export type HtmlDocumentError =
  | "DNS resolution failed"
  | "Invalid SSL certificate"
  | `HTTP ${number}`
  | `Non-HTML content-type: ${string}`;

export interface HtmlDocument {
  ok: boolean;
  finalUrl: string;
  status: number | null;
  contentType: string | null;
  /** Decoded body. Null whenever `ok` is false. */
  html: string | null;
  /** Response headers, names lowercased. Empty when the request never completed. */
  headers: Record<string, string>;
  /** Raw Set-Cookie values. Empty when the request never completed. */
  setCookie: string[];
  error?: string;
}

/**
 * Fetch a domain's homepage HTML.
 *
 * Concurrent calls for the same domain in this process share one fetch (e.g.
 * a report batch where SEO and technology detection both need the page
 * body). Every call that doesn't overlap an in-flight one fetches fresh.
 */
export function fetchHtmlDocument(domain: string): Promise<HtmlDocument> {
  const normalizedDomain = domain.toLowerCase();
  return shareInFlight(`html:${normalizedDomain}`, () => fetchDocument(normalizedDomain));
}

async function fetchDocument(domain: string): Promise<HtmlDocument> {
  let finalUrl = `https://${domain}/`;
  let status: number | null = null;

  try {
    const result = await safeFetch({
      url: finalUrl,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      allowHttp: true,
      timeoutMs: 10_000,
      maxBytes: 512 * 1024,
      maxRedirects: 5,
      truncateOnLimit: true,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
      },
    });

    status = result.status;
    finalUrl = result.finalUrl;

    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(result.headers)) {
      headers[name.toLowerCase()] = value;
    }

    if (!result.ok) {
      return {
        ok: false,
        finalUrl,
        status,
        contentType: result.contentType,
        html: null,
        headers,
        setCookie: result.setCookie,
        error: `HTTP ${result.status}`,
      };
    }

    const contentType = result.contentType ?? "";
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
      return {
        ok: false,
        finalUrl,
        status,
        contentType: result.contentType,
        html: null,
        headers,
        setCookie: result.setCookie,
        error: `Non-HTML content-type: ${contentType}`,
      };
    }

    return {
      ok: true,
      finalUrl,
      status,
      contentType: result.contentType,
      html: result.buffer.toString("utf-8"),
      headers,
      setCookie: result.setCookie,
    };
  } catch (err) {
    if (isExpectedDnsError(err)) {
      return {
        ok: false,
        finalUrl,
        status,
        contentType: null,
        html: null,
        headers: {},
        setCookie: [],
        error: "DNS resolution failed",
      };
    }

    if (isExpectedTlsError(err)) {
      return {
        ok: false,
        finalUrl,
        status,
        contentType: null,
        html: null,
        headers: {},
        setCookie: [],
        error: "Invalid SSL certificate",
      };
    }

    // Transient failure - throw for TanStack Query to retry
    throw new RemoteDataUnavailableError("HTML data unavailable", { cause: err });
  }
}
