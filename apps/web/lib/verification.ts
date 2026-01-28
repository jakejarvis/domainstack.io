import type { VerificationMethod } from "@domainstack/constants";
import {
  DNS_VERIFICATION_HOST_LEGACY,
  DNS_VERIFICATION_PREFIX,
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  HTML_FILE_PATH_LEGACY,
  META_TAG_NAME,
} from "@domainstack/constants";
import {
  providerOrderForLookup,
  queryDohProvider,
} from "@domainstack/core/dns";
import { safeFetch } from "@domainstack/safe-fetch";
import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger/server";

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
        const answers = await queryDohProvider(provider, hostname, "TXT", {
          cacheBust: true, // Bypass caches to check freshly added records
        });

        for (const answer of answers) {
          const value = answer.data.replace(/^"|"$/g, "").trim();
          if (value === expectedValue) {
            return { verified: true, method: "dns_txt" };
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
      const result = await safeFetch({
        url: urlStr,
        userAgent: process.env.EXTERNAL_USER_AGENT,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
        timeoutMs: 5000,
        maxBytes: 1024,
        maxRedirects: 3,
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
      const result = await safeFetch({
        url: urlStr,
        userAgent: process.env.EXTERNAL_USER_AGENT,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
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
      const result = await safeFetch({
        url: urlStr,
        userAgent: process.env.EXTERNAL_USER_AGENT,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
        timeoutMs: 10_000,
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
