import "server-only";

import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "verification" });

// DNS verification constants
const DNS_VERIFICATION_HOST = "_domainstack-verify";
const DNS_VERIFICATION_PREFIX = "domainstack-verify=";

// HTML file verification constants
const HTML_FILE_PATH = "/.well-known/domainstack-verify.txt";

// Meta tag verification constants
const META_TAG_NAME = "domainstack-verify";

type VerificationResult = {
  verified: boolean;
  method: VerificationMethod | null;
  error?: string;
};

type DnsJson = {
  Status: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
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
        return await verifyDnsTxt(domain, token);
      case "html_file":
        return await verifyHtmlFile(domain, token);
      case "meta_tag":
        return await verifyMetaTag(domain, token);
      default:
        return { verified: false, method: null, error: "Unknown method" };
    }
  } catch (err) {
    logger.error("verification failed", err, { domain, method });
    return {
      verified: false,
      method: null,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}

/**
 * Try all verification methods and return the first one that succeeds.
 */
export async function tryAllVerificationMethods(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  logger.debug("trying all verification methods", { domain });

  // Try DNS TXT first (most common/reliable)
  const dnsResult = await verifyDnsTxt(domain, token);
  if (dnsResult.verified) {
    return dnsResult;
  }

  // Try HTML file next
  const htmlResult = await verifyHtmlFile(domain, token);
  if (htmlResult.verified) {
    return htmlResult;
  }

  // Try meta tag last
  const metaResult = await verifyMetaTag(domain, token);
  if (metaResult.verified) {
    return metaResult;
  }

  return { verified: false, method: null };
}

/**
 * Verify ownership via DNS TXT record.
 * Expected record: _domainstack-verify.example.com TXT "domainstack-verify=<token>"
 */
async function verifyDnsTxt(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;
  const verifyHost = `${DNS_VERIFICATION_HOST}.${domain}`;

  try {
    // Use Cloudflare DNS over HTTPS for resolution
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.searchParams.set("name", verifyHost);
    url.searchParams.set("type", "TXT");

    const res = await fetchWithTimeoutAndRetry(
      url,
      {
        headers: {
          accept: "application/dns-json",
        },
      },
      { timeoutMs: 5000, retries: 2, backoffMs: 200 },
    );

    if (!res.ok) {
      logger.warn("DNS query failed", { domain, status: res.status });
      return { verified: false, method: null, error: "DNS query failed" };
    }

    const json = (await res.json()) as DnsJson;
    const answers = json.Answer ?? [];

    // Check if any TXT record matches
    for (const answer of answers) {
      // TXT record type is 16
      if (answer.type === 16) {
        // Remove surrounding quotes from TXT record value
        const value = answer.data.replace(/^"|"$/g, "").trim();
        if (value === expectedValue) {
          logger.info("DNS TXT verification successful", { domain });
          return { verified: true, method: "dns_txt" };
        }
      }
    }

    logger.debug("DNS TXT record not found or mismatched", { domain });
    return { verified: false, method: null };
  } catch (err) {
    logger.error("DNS TXT verification error", err, { domain });
    return {
      verified: false,
      method: null,
      error: "DNS resolution failed",
    };
  }
}

/**
 * Verify ownership via HTML file.
 * Expected file: https://example.com/.well-known/domainstack-verify.txt
 * Contents should exactly match the token (after trimming whitespace).
 */
async function verifyHtmlFile(
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
      const res = await fetchWithTimeoutAndRetry(
        urlStr,
        {
          redirect: "follow",
        },
        { timeoutMs: 5000, retries: 1, backoffMs: 200 },
      );

      if (!res.ok) {
        continue;
      }

      const text = await res.text();
      // Check if the trimmed file content exactly matches the token
      if (text.trim() === token) {
        logger.info("HTML file verification successful", { domain });
        return { verified: true, method: "html_file" };
      }
    } catch {}
  }

  logger.debug("HTML file verification failed", { domain });
  return { verified: false, method: null };
}

/**
 * Verify ownership via meta tag.
 * Expected tag: <meta name="domainstack-verify" content="<token>">
 */
async function verifyMetaTag(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  // Try both HTTPS and HTTP
  const urls = [`https://${domain}/`, `http://${domain}/`];

  for (const urlStr of urls) {
    try {
      const res = await fetchWithTimeoutAndRetry(
        urlStr,
        {
          headers: {
            accept: "text/html",
          },
          redirect: "follow",
        },
        { timeoutMs: 10000, retries: 1, backoffMs: 500 },
      );

      if (!res.ok) {
        continue;
      }

      const html = await res.text();

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
    } catch {}
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
  _domain: string,
  token: string,
  method: VerificationMethod,
): {
  title: string;
  description: string;
  code: string;
  copyValue: string;
} {
  switch (method) {
    case "dns_txt":
      return {
        title: "Add a DNS TXT Record",
        description:
          "Add the following TXT record to your domain's DNS settings. This may take up to 24 hours to propagate.",
        code: `Host: ${DNS_VERIFICATION_HOST}\nType: TXT\nValue: ${DNS_VERIFICATION_PREFIX}${token}`,
        copyValue: `${DNS_VERIFICATION_PREFIX}${token}`,
      };
    case "html_file":
      return {
        title: "Upload an HTML File",
        description: `Create a text file at ${HTML_FILE_PATH} on your website's root directory.`,
        code: `Path: ${HTML_FILE_PATH}\nContents: ${token}`,
        copyValue: token,
      };
    case "meta_tag":
      return {
        title: "Add a Meta Tag",
        description:
          "Add the following meta tag to the <head> section of your homepage.",
        code: `<meta name="${META_TAG_NAME}" content="${token}">`,
        copyValue: `<meta name="${META_TAG_NAME}" content="${token}">`,
      };
  }
}
