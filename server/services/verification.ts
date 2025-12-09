import "server-only";

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
import { addSpanAttributes, withSpan } from "@/lib/tracing";

const logger = createLogger({ source: "verification" });

// DNS verification constants
const DNS_VERIFICATION_HOST = "_domainstack-verify";
const DNS_VERIFICATION_PREFIX = "domainstack-verify=";

// HTML file verification constants
const HTML_FILE_PATH = "/.well-known/domainstack-verify.html";

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
export const verifyDomainOwnership = withSpan(
  ([domain, _token, method]: [string, string, VerificationMethod]) => ({
    name: "verification.verify",
    attributes: {
      "verification.domain": domain,
      "verification.method": method,
    },
  }),
  async function verifyDomainOwnership(
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
      addSpanAttributes({
        "verification.verified": false,
        "verification.error": true,
        "verification.error_message": errorMessage,
      });
      return {
        verified: false,
        method: null,
        error: errorMessage,
      };
    }
  },
);

/**
 * Try all verification methods and return the first one that succeeds.
 */
export const tryAllVerificationMethods = withSpan(
  ([domain, _token]: [string, string]) => ({
    name: "verification.try_all",
    attributes: { "verification.domain": domain },
  }),
  async function tryAllVerificationMethods(
    domain: string,
    token: string,
  ): Promise<VerificationResult> {
    logger.debug("trying all verification methods", { domain });

    // Try DNS TXT first (most common/reliable)
    const dnsResult = await verifyDnsTxtImpl(domain, token);
    if (dnsResult.verified) {
      addSpanAttributes({
        "verification.verified": true,
        "verification.method": "dns_txt",
      });
      return dnsResult;
    }

    // Try HTML file next
    const htmlResult = await verifyHtmlFileImpl(domain, token);
    if (htmlResult.verified) {
      addSpanAttributes({
        "verification.verified": true,
        "verification.method": "html_file",
      });
      return htmlResult;
    }

    // Try meta tag last
    const metaResult = await verifyMetaTagImpl(domain, token);
    if (metaResult.verified) {
      addSpanAttributes({
        "verification.verified": true,
        "verification.method": "meta_tag",
      });
      return metaResult;
    }

    addSpanAttributes({ "verification.verified": false });
    return { verified: false, method: null };
  },
);

/**
 * Verify ownership via DNS TXT record.
 * Expected record: _domainstack-verify.example.com TXT "domainstack-verify=<token>"
 *
 * Uses multiple DoH providers for reliability and cache busting.
 * Leverages the same provider ordering and fallback logic as dns.ts.
 */
async function verifyDnsTxtImpl(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;
  const verifyHost = `${DNS_VERIFICATION_HOST}.${domain}`;

  // Use the same provider ordering logic as dns.ts for consistency
  const providers = providerOrderForLookup(domain);

  let lastError: unknown = null;

  // Try providers in sequence
  for (const provider of providers) {
    try {
      const url = buildDohUrl(provider, verifyHost, "TXT");
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
      logger.warn("DNS provider error", {
        domain,
        provider: provider.key,
        error: err,
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
 * Expected file: https://example.com/.well-known/domainstack-verify.html
 * Contents should exactly match the token (after trimming whitespace).
 *
 * Uses SSRF-protected fetch to prevent DNS rebinding and internal network attacks.
 */
async function verifyHtmlFileImpl(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  // Try both HTTPS and HTTP
  const urls = [
    `https://${domain}${HTML_FILE_PATH}`,
    `http://${domain}${HTML_FILE_PATH}`,
  ];

  for (const urlStr of urls) {
    try {
      // Use SSRF-protected fetch that validates DNS resolution
      // and blocks requests to private/internal IP ranges
      const result = await fetchRemoteAsset({
        url: urlStr,
        allowHttp: true,
        timeoutMs: 5000,
        maxBytes: 1024, // Verification file should be tiny
        maxRedirects: 3,
      });

      // Check if the trimmed file content exactly matches the token
      if (result.buffer.toString("utf-8").trim() === token) {
        logger.info("HTML file verification successful", { domain });
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      // Log SSRF blocks as warnings (potential attack attempts)
      if (err instanceof RemoteAssetError) {
        if (err.code === "private_ip" || err.code === "host_blocked") {
          logger.warn("HTML file verification blocked (SSRF protection)", {
            domain,
            url: urlStr,
            reason: err.code,
          });
        } else {
          logger.debug("HTML file fetch error", {
            domain,
            url: urlStr,
            code: err.code,
          });
        }
      } else {
        logger.debug("HTML file fetch error", {
          error: err,
          domain,
          url: urlStr,
        });
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

      // Look for the meta tag with a simple regex
      // Matches: <meta name="domainstack-verify" content="TOKEN">
      // Also matches with single quotes and different attribute orders
      const metaRegex = new RegExp(
        `<meta[^>]*name=["']${META_TAG_NAME}["'][^>]*content=["']([^"']+)["'][^>]*/?>|<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${META_TAG_NAME}["'][^>]*/?>`,
        "i",
      );

      const match = html.match(metaRegex);
      if (match) {
        const content = (match[1] || match[2] || "").trim();
        if (content === token) {
          logger.info("Meta tag verification successful", { domain });
          return { verified: true, method: "meta_tag" };
        }
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
        hostname: `${DNS_VERIFICATION_HOST}.${domain}`,
        recordType: "TXT",
        value: `${DNS_VERIFICATION_PREFIX}${token}`,
        suggestedTTL: 60,
        suggestedTTLLabel: "1 minute",
      };
    case "html_file":
      return {
        title: "Upload an HTML File",
        description: `Upload a file to your website at the path shown below.`,
        fullPath: HTML_FILE_PATH,
        filename: "domainstack-verify.html",
        fileContent: token,
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
