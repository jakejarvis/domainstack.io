/**
 * HTTP headers fetching logic.
 *
 * Pure functions for fetching HTTP headers from domains.
 * Does not handle persistence - that's done by callers (workflows, services).
 */

import { isExpectedDnsError, safeFetch } from "@domainstack/safe-fetch";
import type { Header } from "@domainstack/types";
import { getStatusCode } from "@readme/http-status-codes";
import { isExpectedTlsError } from "../tls";
import type { HeadersFetchResult } from "./types";

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Error thrown when headers fetch fails transiently.
 * DNS and TLS errors are not thrown - they're returned as error results.
 */
export class HeadersFetchError extends Error {
  constructor(message = "Headers fetch failed") {
    super(message);
    this.name = "HeadersFetchError";
  }
}

/**
 * Fetch HTTP headers from a domain.
 *
 * DNS and TLS errors are returned as failure results (permanent).
 * Other errors throw HeadersFetchError (transient, should retry).
 *
 * @param domain - The domain to probe
 * @returns Headers fetch result with data or typed error
 */
export async function fetchHttpHeaders(
  domain: string,
): Promise<HeadersFetchResult> {
  const allowedHosts = [domain, `www.${domain}`];

  try {
    const final = await safeFetch({
      url: `https://${domain}/`,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      allowHttp: true,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      allowedHosts,
      method: "HEAD",
      fallbackToGetOnHeadFailure: true,
      returnOnDisallowedRedirect: true,
    });

    const headers: Header[] = Object.entries(final.headers).map(
      ([name, value]) => ({ name: name.trim().toLowerCase(), value }),
    );

    // Get status message
    let statusMessage: string | undefined;
    try {
      const statusInfo = getStatusCode(final.status);
      statusMessage = statusInfo.message;
    } catch {
      statusMessage = undefined;
    }

    return {
      success: true,
      data: {
        headers,
        status: final.status,
        statusMessage,
      },
    };
  } catch (err) {
    const isDnsError = isExpectedDnsError(err);
    const isTlsError = isExpectedTlsError(err);

    // Permanent failures - return error result
    if (isDnsError) {
      return { success: false, error: "dns_error" };
    }
    if (isTlsError) {
      return { success: false, error: "tls_error" };
    }

    // Transient failure - throw for caller to handle
    throw new HeadersFetchError();
  }
}
