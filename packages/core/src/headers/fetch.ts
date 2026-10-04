/**
 * HTTP headers fetching logic.
 *
 * Pure functions for fetching HTTP headers from domains.
 * Does not handle persistence - that's done by callers (workflows, services).
 */

import { isExpectedDnsError } from "@domainstack/safe-fetch/dns";
import type { Header } from "@domainstack/types";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchHomepage } from "../lib/homepage";
import { isExpectedTlsError } from "../tls/utils";
import { getHttpStatusMessage } from "./status-message";
import type { HeadersFetchResult } from "./types";

/**
 * Fetch HTTP headers from a domain.
 *
 * The default GET shares its request with the SEO service's page fetch (see
 * `fetchHomepage`). Pass `method: "HEAD"` when nothing else needs the body.
 *
 * DNS and TLS errors are returned as failure results (permanent).
 * Other errors throw RemoteDataUnavailableError (transient, should retry).
 *
 * @param domain - The domain to probe
 * @returns Headers fetch result with data or typed error
 */
export async function fetchHttpHeaders(
  domain: string,
  options: { method?: "GET" | "HEAD" } = {},
): Promise<HeadersFetchResult> {
  try {
    const final = await fetchHomepage(domain, options);

    // `final.headers` collapses repeated Set-Cookie into the last one, so add each back separately.
    const headers: Header[] = [
      ...Object.entries(final.headers)
        .filter(([name]) => name.trim().toLowerCase() !== "set-cookie")
        .map(([name, value]) => ({ name: name.trim().toLowerCase(), value })),
      ...final.setCookies.map((value) => ({ name: "set-cookie", value })),
    ];

    return {
      success: true,
      data: {
        headers,
        status: final.status,
        statusMessage: getHttpStatusMessage(final.status),
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

    // Transient failure - throw for caller to handle (with cause for debugging)
    throw new RemoteDataUnavailableError("HTTP headers unavailable", { cause: err });
  }
}
