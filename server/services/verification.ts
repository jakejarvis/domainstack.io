import "server-only";

import * as cheerio from "cheerio";
import {
  DNS_VERIFICATION_HOST_LEGACY,
  DNS_VERIFICATION_PREFIX,
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  HTML_FILE_PATH_LEGACY,
  META_TAG_NAME,
} from "@/lib/constants/verification";
import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";
import {
  buildDohUrl,
  DNS_TYPE_NUMBERS,
  type DnsJson,
  DOH_HEADERS,
  providerOrderForLookup,
} from "@/lib/dns-utils";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { fetchRemoteAsset } from "@/lib/fetch-remote-asset";
import { createLogger } from "@/lib/logger/server";
import type { VerificationInstructions } from "@/lib/schemas";
import { buildVerificationInstructions } from "@/lib/verification/instructions";

const logger = createLogger({ source: "verification" });

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
  // Try DNS TXT first (most common/reliable)
  try {
    const dnsResult = await verifyDnsTxtImpl(domain, token);
    if (dnsResult.verified) {
      return dnsResult;
    }
  } catch (err) {
    logger.warn({ err, domain }, "dns verification threw unexpectedly");
    // Continue to next method
  }

  // Try HTML file next
  try {
    const htmlResult = await verifyHtmlFileImpl(domain, token);
    if (htmlResult.verified) {
      return htmlResult;
    }
  } catch (err) {
    logger.warn({ err, domain }, "file verification threw unexpectedly");
    // Continue to next method
  }

  // Try meta tag last
  try {
    const metaResult = await verifyMetaTagImpl(domain, token);
    if (metaResult.verified) {
      return metaResult;
    }
  } catch (err) {
    logger.warn({ err, domain }, "meta tag verification threw unexpectedly");
    // Fall through to return unverified
  }

  return { verified: false, method: null };
}

/**
 * Verify ownership via DNS TXT record.
 * Expected record: example.com TXT "domainstack-verify=<token>"
 *
 * For backward compatibility, also checks legacy subdomain format:
 * _domainstack-verify.example.com TXT "domainstack-verify=<token>"
 *
 * Uses multiple DoH providers for reliability and cache busting.
 * Leverages the same provider ordering and fallback logic as dns.ts.
 */
async function verifyDnsTxtImpl(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;

  // Check both apex domain (new) and legacy subdomain format
  const hostsToCheck = [
    domain, // New format: example.com
    `${DNS_VERIFICATION_HOST_LEGACY}.${domain}`, // Legacy format: _domainstack-verify.example.com
  ];

  // Use the same provider ordering logic as dns.ts for consistency
  const providers = providerOrderForLookup(domain);

  // Try each hostname with all providers
  for (const hostname of hostsToCheck) {
    // Try providers in sequence for this hostname
    for (const provider of providers) {
      try {
        const url = buildDohUrl(provider, hostname, "TXT");
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
              return { verified: true, method: "dns_txt" };
            }
          }
        }
      } catch (err) {
        logger.warn({ err, domain }, "dns verification threw unexpectedly");
      }
    }
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
        allowedHosts: [domain, `www.${domain}`],
      });

      // Skip non-OK responses (404, etc.) - try next URL
      if (!result.ok) {
        continue;
      }

      // File must contain "domainstack-verify: TOKEN" (trimmed)
      const content = result.buffer.toString("utf-8").trim();
      if (content === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      logger.warn({ err, domain }, "file verification threw unexpectedly");
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

      // Skip non-OK responses (404, etc.) - try next URL
      if (!result.ok) {
        continue;
      }

      // Legacy method: same content format "domainstack-verify: TOKEN"
      if (result.buffer.toString("utf-8").trim() === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      logger.warn({ err, domain }, "file verification threw unexpectedly");
    }
  }

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

      // Skip non-OK responses - try next URL
      if (!result.ok) {
        continue;
      }

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
        return { verified: true, method: "meta_tag" };
      }
    } catch (err) {
      logger.warn({ err, domain }, "meta tag verification threw unexpectedly");
    }
  }

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

export { buildVerificationInstructions };

// Re-export type for convenience in server code (keep server logic thin).
export type { VerificationInstructions };
