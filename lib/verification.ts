import * as cheerio from "cheerio";
import {
  DNS_VERIFICATION_HOST_LEGACY,
  DNS_VERIFICATION_PREFIX,
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  HTML_FILE_PATH_LEGACY,
  META_TAG_NAME,
} from "@/lib/constants/verification";
import {
  buildDohUrl,
  DNS_TYPE_NUMBERS,
  DOH_HEADERS,
  providerOrderForLookup,
} from "@/lib/dns-utils";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { fetchRemoteAsset } from "@/lib/fetch-remote-asset";
import { createLogger } from "@/lib/logger/server";
import type { VerificationMethod } from "@/lib/types";

const logger = createLogger({ source: "verification" });

export interface VerificationResult {
  verified: boolean;
  method: VerificationMethod | null;
}

/**
 * Verify domain ownership via DNS TXT record.
 *
 * Expected record: example.com TXT "domainstack-verify=<token>"
 * Also checks legacy format: _domainstack-verify.example.com TXT "domainstack-verify=<token>"
 *
 * Uses multiple DoH providers for reliability and cache busting.
 */
export async function verifyByDns(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;

  // Check both apex domain (new) and legacy subdomain format
  const hostsToCheck = [
    domain, // New format: example.com
    `${DNS_VERIFICATION_HOST_LEGACY}.${domain}`, // Legacy: _domainstack-verify.example.com
  ];

  const providers = providerOrderForLookup(domain);

  for (const hostname of hostsToCheck) {
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

        const json = (await res.json()) as {
          Answer?: Array<{ type: number; data: string }>;
        };
        const answers = json.Answer ?? [];

        for (const answer of answers) {
          if (answer.type === DNS_TYPE_NUMBERS.TXT) {
            const value = answer.data.replace(/^"|"$/g, "").trim();
            if (value === expectedValue) {
              return { verified: true, method: "dns_txt" };
            }
          }
        }
      } catch (err) {
        logger.warn(
          { err, domain, provider: provider.key },
          "DNS verification failed",
        );
      }
    }
  }

  return { verified: false, method: null };
}

/**
 * Verify domain ownership via HTML file.
 *
 * Supports two methods (checked in order):
 * 1. Per-token file: /.well-known/domainstack-verify/{token}.html
 * 2. Legacy single file: /.well-known/domainstack-verify.html
 *
 * File contents must match: "domainstack-verify: TOKEN"
 */
export async function verifyByHtmlFile(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedContent = `${HTML_FILE_CONTENT_PREFIX}${token}`;

  // Build URL lists for both methods, trying HTTPS first then HTTP
  const perTokenUrls = [
    `https://${domain}${HTML_FILE_DIR}/${token}.html`,
    `http://${domain}${HTML_FILE_DIR}/${token}.html`,
  ];
  const legacyUrls = [
    `https://${domain}${HTML_FILE_PATH_LEGACY}`,
    `http://${domain}${HTML_FILE_PATH_LEGACY}`,
  ];

  // Try per-token file first (new multi-user method)
  for (const urlStr of perTokenUrls) {
    try {
      const result = await fetchRemoteAsset({
        url: urlStr,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
      });

      if (!result.ok) {
        continue;
      }

      const content = result.buffer.toString("utf-8").trim();
      if (content === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      logger.warn(
        { err, domain, url: urlStr },
        "HTML file verification failed",
      );
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

      if (!result.ok) {
        continue;
      }

      if (result.buffer.toString("utf-8").trim() === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch (err) {
      logger.warn(
        { err, domain, url: urlStr },
        "Legacy HTML file verification failed",
      );
    }
  }

  return { verified: false, method: null };
}

/**
 * Verify domain ownership via meta tag.
 *
 * Expected tag: <meta name="domainstack-verify" content="TOKEN">
 *
 * Uses cheerio for robust HTML parsing.
 * Checks ALL verification meta tags to support multiple users tracking the same domain.
 */
export async function verifyByMetaTag(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  // Try both HTTPS and HTTP
  const urls = [`https://${domain}/`, `http://${domain}/`];
  const MAX_HTML_BYTES = 512 * 1024; // 512KB

  for (const urlStr of urls) {
    try {
      const result = await fetchRemoteAsset({
        url: urlStr,
        allowHttp: true,
        timeoutMs: 10000,
        maxBytes: MAX_HTML_BYTES,
        maxRedirects: 5,
      });

      if (!result.ok) {
        continue;
      }

      const html = result.buffer.toString("utf-8");
      const $ = cheerio.load(html);

      // Find ALL meta tags with name="domainstack-verify"
      const metaTags = $(`meta[name="${META_TAG_NAME}"]`);

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
      logger.warn({ err, domain, url: urlStr }, "Meta tag verification failed");
    }
  }

  return { verified: false, method: null };
}

/**
 * Verify domain ownership by trying all methods in order.
 * Returns on first successful verification.
 */
export async function verifyDomain(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  // Try DNS first (most reliable)
  const dnsResult = await verifyByDns(domain, token);
  if (dnsResult.verified) return dnsResult;

  // Try HTML file
  const htmlResult = await verifyByHtmlFile(domain, token);
  if (htmlResult.verified) return htmlResult;

  // Try meta tag
  const metaResult = await verifyByMetaTag(domain, token);
  if (metaResult.verified) return metaResult;

  return { verified: false, method: null };
}

/**
 * Verify domain ownership using a specific method only.
 */
export async function verifyDomainByMethod(
  domain: string,
  token: string,
  method: VerificationMethod,
): Promise<VerificationResult> {
  switch (method) {
    case "dns_txt":
      return await verifyByDns(domain, token);
    case "html_file":
      return await verifyByHtmlFile(domain, token);
    case "meta_tag":
      return await verifyByMetaTag(domain, token);
    default:
      return { verified: false, method: null };
  }
}
