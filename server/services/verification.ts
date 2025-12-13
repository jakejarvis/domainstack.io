import "server-only";

import * as cheerio from "cheerio";
import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";
import {
  buildDohUrl,
  DNS_TYPE_NUMBERS,
  type DnsJson,
  DOH_HEADERS,
  providerOrderForLookup,
} from "@/lib/dns-utils";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { fetchRemoteAsset, RemoteAssetError } from "@/lib/fetch-remote-asset";
import { createLogger } from "@/lib/logger/server";
import type {
  DnsInstructions,
  HtmlFileInstructions,
  MetaTagInstructions,
} from "@/lib/schemas";

const logger = createLogger({ source: "verification" });

// DNS verification constants
const DNS_VERIFICATION_PREFIX = "domainstack-verify=";

// HTML file verification constants
// New: per-token file in a directory (supports multiple users)
const HTML_FILE_DIR = "/.well-known/domainstack-verify";
// Legacy: single file (backward compatibility)
const HTML_FILE_PATH_LEGACY = "/.well-known/domainstack-verify.html";
// Content format: "domainstack-verify: TOKEN"
const HTML_FILE_CONTENT_PREFIX = "domainstack-verify: ";

// Meta tag verification constants
const META_TAG_NAME = "domainstack-verify";

type VerificationResult = {
  verified: boolean;
  method: VerificationMethod | null;
  error?: string;
};

/**
 * Verify domain ownership using the specified method.
 */
export async function verifyDomainOwnership(
  domain: string,
  token: string,
  method: VerificationMethod,
): Promise<VerificationResult> {
  logger.debug("verifying domain ownership", { domain, method });

  try {
    switch (method) {
      case "dns_txt":
        return await verifyDnsTxtImpl(domain, token);
      case "html_file":
        return await verifyHtmlFileImpl(domain, token);
      case "meta_tag":
        return await verifyMetaTagImpl(domain, token);
      default:
        return { verified: false, method: null, error: "Unknown method" };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("verification failed", err, { domain, method });
    return {
      verified: false,
      method: null,
      error: errorMessage,
    };
  }
}

/**
 * Try all verification methods and return the first one that succeeds.
 * Each method is wrapped in try-catch to ensure unexpected errors don't
 * prevent trying remaining methods.
 */
export async function tryAllVerificationMethods(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  logger.debug("trying all verification methods", { domain });

  // Try DNS TXT first (most common/reliable)
  try {
    const dnsResult = await verifyDnsTxtImpl(domain, token);
    if (dnsResult.verified) {
      return dnsResult;
    }
  } catch (err) {
    logger.warn("dns verification threw unexpectedly", err, { domain });
    // Continue to next method
  }

  // Try HTML file next
  try {
    const htmlResult = await verifyHtmlFileImpl(domain, token);
    if (htmlResult.verified) {
      return htmlResult;
    }
  } catch (err) {
    logger.warn("html verification threw unexpectedly", err, { domain });
    // Continue to next method
  }

  // Try meta tag last
  try {
    const metaResult = await verifyMetaTagImpl(domain, token);
    if (metaResult.verified) {
      return metaResult;
    }
  } catch (err) {
    logger.warn("meta verification threw unexpectedly", err, { domain });
    // Fall through to return unverified
  }

  return { verified: false, method: null };
}

/**
 * Verify ownership via DNS TXT record.
 * Expected record: example.com TXT "domainstack-verify=<token>"
 *
 * Uses multiple DoH providers for reliability and cache busting.
 * Leverages the same provider ordering and fallback logic as dns.ts.
 */
async function verifyDnsTxtImpl(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;

  // Use the same provider ordering logic as dns.ts for consistency
  const providers = providerOrderForLookup(domain);

  let lastError: unknown = null;

  // Try providers in sequence
  for (const provider of providers) {
    try {
      const url = buildDohUrl(provider, domain, "TXT");
      // Add random parameter to bypass HTTP caches
      url.searchParams.set("t", Date.now().toString());

      const res = await fetchWithTimeoutAndRetry(
        url,
        {
          headers: { ...DOH_HEADERS, ...provider.headers },
        },
        { timeoutMs: 5000, retries: 1, backoffMs: 200 },
      );
      if (!res.ok) {
        logger.warn("DNS query failed", {
          domain,
          provider: provider.key,
          status: res.status,
        });
        continue;
      }

      const json = (await res.json()) as DnsJson;
      const answers = json.Answer ?? [];

      // Check if any TXT record matches
      for (const answer of answers) {
        if (answer.type === DNS_TYPE_NUMBERS.TXT) {
          // TXT
          // Remove surrounding quotes from TXT record value
          const value = answer.data.replace(/^"|"$/g, "").trim();
          if (value === expectedValue) {
            logger.info("DNS TXT verification successful", {
              domain,
              provider: provider.key,
            });
            return { verified: true, method: "dns_txt" };
          }
        }
      }
    } catch (err) {
      logger.warn("DNS provider error", err, {
        domain,
        provider: provider.key,
      });
      lastError = err;
    }
  }

  logger.debug(
    "DNS TXT record not found or mismatched after checking providers",
    {
      domain,
    },
  );
  if (lastError) {
    logger.error("DNS TXT verification final error", lastError, { domain });
  }

  return { verified: false, method: null };
}

/**
 * Verify ownership via HTML file.
 *
 * Supports two methods (checked in order):
 * 1. Per-token file (multi-user): /.well-known/domainstack-verify/{token}.html
 *    - Each user has their own file, no conflicts
 *    - File contents must exactly match the token
 * 2. Legacy single file: /.well-known/domainstack-verify.html
 *    - Contents should exactly match the token (backward compatibility)
 *
 * Uses SSRF-protected fetch to prevent DNS rebinding and internal network attacks.
 */
async function verifyHtmlFileImpl(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  // Build URL lists for both methods, trying HTTPS first then HTTP
  const perTokenUrls = [
    `https://${domain}${HTML_FILE_DIR}/${token}.html`,
    `http://${domain}${HTML_FILE_DIR}/${token}.html`,
  ];
  const legacyUrls = [
    `https://${domain}${HTML_FILE_PATH_LEGACY}`,
    `http://${domain}${HTML_FILE_PATH_LEGACY}`,
  ];

  // Expected file content format
  const expectedContent = `${HTML_FILE_CONTENT_PREFIX}${token}`;

  // Try per-token file first (new multi-user method)
  for (const urlStr of perTokenUrls) {
    try {
      const result = await fetchRemoteAsset({
        url: urlStr,
        allowHttp: true,
        timeoutMs: 5000,
        maxBytes: 1024,
        maxRedirects: 3,
      });

      // File must contain "domainstack-verify: TOKEN" (trimmed)
      const content = result.buffer.toString("utf-8").trim();
      if (content === expectedContent) {
        logger.info("HTML file verification successful (per-token file)", {
          domain,
        });
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      // Log SSRF blocks as warnings, other errors as debug
      if (err instanceof RemoteAssetError) {
        if (err.code === "private_ip" || err.code === "host_blocked") {
          logger.warn("HTML file verification blocked (SSRF protection)", {
            domain,
            url: urlStr,
            reason: err.code,
          });
        }
        // Other errors (404, etc.) are expected - try next URL
      }
    }
  }

  // Fall back to legacy single file method
  for (const urlStr of legacyUrls) {
    try {
      const result = await fetchRemoteAsset({
        url: urlStr,
        allowHttp: true,
        timeoutMs: 5000,
        maxBytes: 1024,
        maxRedirects: 3,
      });

      // Legacy method: same content format "domainstack-verify: TOKEN"
      if (result.buffer.toString("utf-8").trim() === expectedContent) {
        logger.info("HTML file verification successful (legacy file)", {
          domain,
        });
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      if (err instanceof RemoteAssetError) {
        if (err.code === "private_ip" || err.code === "host_blocked") {
          logger.warn("HTML file verification blocked (SSRF protection)", {
            domain,
            url: urlStr,
            reason: err.code,
          });
        }
      }
    }
  }

  logger.debug("HTML file verification failed", { domain });
  return { verified: false, method: null };
}

/**
 * Verify ownership via meta tag.
 * Expected tag: <meta name="domainstack-verify" content="<token>">
 *
 * Uses cheerio for robust HTML parsing instead of regex.
 * Multiple users can track the same domain, so we check ALL verification meta tags
 * and return true if any of them match the provided token.
 *
 * Uses SSRF-protected fetch to prevent DNS rebinding and internal network attacks.
 */
async function verifyMetaTagImpl(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  // Try both HTTPS and HTTP
  const urls = [`https://${domain}/`, `http://${domain}/`];

  // HTML pages can be larger, but we still limit to prevent abuse
  const MAX_HTML_BYTES = 512 * 1024; // 512KB should be enough for any homepage head

  for (const urlStr of urls) {
    try {
      // Use SSRF-protected fetch that validates DNS resolution
      // and blocks requests to private/internal IP ranges
      const result = await fetchRemoteAsset({
        url: urlStr,
        allowHttp: true,
        timeoutMs: 10000,
        maxBytes: MAX_HTML_BYTES,
        maxRedirects: 5, // Homepages often have multiple redirects
      });

      const html = result.buffer.toString("utf-8");

      // Use cheerio for robust HTML parsing
      // This handles edge cases that regex would miss (malformed HTML, comments, etc.)
      const $ = cheerio.load(html);

      // Find ALL meta tags with name="domainstack-verify"
      // Multiple users can track the same domain, so there may be multiple verification tags
      const metaTags = $(`meta[name="${META_TAG_NAME}"]`);

      // Check if any meta tag's content matches our token
      let foundMatch = false;
      metaTags.each((_, element) => {
        const content = $(element).attr("content")?.trim();
        if (content === token) {
          foundMatch = true;
          return false; // Break out of .each() loop
        }
      });

      if (foundMatch) {
        logger.info("Meta tag verification successful", {
          domain,
          totalMetaTags: metaTags.length,
        });
        return { verified: true, method: "meta_tag" };
      }

      // Log if we found meta tags but none matched (helps debugging)
      if (metaTags.length > 0) {
        logger.debug("Meta tags found but no match", {
          domain,
          metaTagCount: metaTags.length,
        });
      }
    } catch (err) {
      // Log SSRF blocks as warnings (potential attack attempts)
      if (err instanceof RemoteAssetError) {
        if (err.code === "private_ip" || err.code === "host_blocked") {
          logger.warn("Meta tag verification blocked (SSRF protection)", {
            domain,
            url: urlStr,
            reason: err.code,
          });
        } else {
          logger.debug("Meta tag fetch error", {
            domain,
            url: urlStr,
            code: err.code,
          });
        }
      } else {
        logger.debug("Meta tag fetch error", {
          error: err,
          domain,
          url: urlStr,
        });
      }
    }
  }

  logger.debug("Meta tag verification failed", { domain });
  return { verified: false, method: null };
}

/**
 * Generate a secure verification token.
 */
export function generateVerificationToken(): string {
  // Generate a random 32-character hex string
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get verification instructions for a specific method.
 */
export function getVerificationInstructions(
  domain: string,
  token: string,
  method: "dns_txt",
): DnsInstructions;
export function getVerificationInstructions(
  domain: string,
  token: string,
  method: "html_file",
): HtmlFileInstructions;
export function getVerificationInstructions(
  domain: string,
  token: string,
  method: "meta_tag",
): MetaTagInstructions;
export function getVerificationInstructions(
  domain: string,
  token: string,
  method: VerificationMethod,
): DnsInstructions | HtmlFileInstructions | MetaTagInstructions {
  switch (method) {
    case "dns_txt":
      return {
        title: "Add a DNS TXT Record",
        description:
          "Add the following TXT record to your domain's DNS settings. Changes may take a few minutes to propagate.",
        hostname: domain,
        recordType: "TXT",
        value: `${DNS_VERIFICATION_PREFIX}${token}`,
        suggestedTTL: 60,
        suggestedTTLLabel: "1 minute",
      };
    case "html_file":
      return {
        title: "Upload an HTML File",
        description:
          "Create a file at the path shown below with the content shown.",
        fullPath: `${HTML_FILE_DIR}/${token}.html`,
        filename: `${token}.html`,
        fileContent: `${HTML_FILE_CONTENT_PREFIX}${token}`,
      };
    case "meta_tag":
      return {
        title: "Add a Meta Tag",
        description:
          "Add the following meta tag to the <head> section of your homepage.",
        metaTag: `<meta name="${META_TAG_NAME}" content="${token}">`,
      };
  }
}
