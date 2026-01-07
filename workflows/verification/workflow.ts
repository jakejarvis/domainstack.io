import type { VerificationMethod } from "@/lib/types";

export interface VerificationWorkflowInput {
  domain: string;
  token: string;
  /** If specified, only try this method. Otherwise try all methods. */
  method?: VerificationMethod;
}

export type VerificationWorkflowResult =
  | {
      success: true;
      data: { verified: boolean; method: VerificationMethod | null };
    }
  | {
      success: false;
      error?: string;
      data: { verified: false; method: null };
    };

/**
 * Durable verification workflow that checks domain ownership
 * using DNS TXT records, HTML files, or meta tags.
 *
 * Each verification method is a separate step for durability and retry.
 * When no specific method is provided, tries all methods in order:
 * 1. DNS TXT (most reliable)
 * 2. HTML file
 * 3. Meta tag
 */
export async function verificationWorkflow(
  input: VerificationWorkflowInput,
): Promise<VerificationWorkflowResult> {
  "use workflow";

  const { domain, token, method } = input;

  // If a specific method is requested, only try that one
  if (method) {
    switch (method) {
      case "dns_txt":
        return await verifyByDns(domain, token);
      case "html_file":
        return await verifyByHtmlFile(domain, token);
      case "meta_tag":
        return await verifyByMetaTag(domain, token);
      default:
        return {
          success: false,
          error: "Unknown method",
          data: { verified: false, method: null },
        };
    }
  }

  // Try all methods in order of reliability
  // DNS TXT first (most common/reliable)
  const dnsResult = await verifyByDns(domain, token);
  if (dnsResult.success && dnsResult.data.verified) {
    return dnsResult;
  }

  // HTML file next
  const htmlResult = await verifyByHtmlFile(domain, token);
  if (htmlResult.success && htmlResult.data.verified) {
    return htmlResult;
  }

  // Meta tag last
  const metaResult = await verifyByMetaTag(domain, token);
  if (metaResult.success && metaResult.data.verified) {
    return metaResult;
  }

  return {
    success: true,
    data: { verified: false, method: null },
  };
}

/**
 * Step: Verify domain ownership via DNS TXT record.
 *
 * Expected record: example.com TXT "domainstack-verify=<token>"
 * Also checks legacy format: _domainstack-verify.example.com TXT "domainstack-verify=<token>"
 *
 * Uses multiple DoH providers for reliability and cache busting.
 */
async function verifyByDns(
  domain: string,
  token: string,
): Promise<VerificationWorkflowResult> {
  "use step";

  const { DNS_VERIFICATION_PREFIX, DNS_VERIFICATION_HOST_LEGACY } =
    await import("@/lib/constants/verification");
  const { buildDohUrl, DNS_TYPE_NUMBERS, DOH_HEADERS, providerOrderForLookup } =
    await import("@/lib/dns-utils");
  const { fetchWithTimeoutAndRetry } = await import("@/lib/fetch");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "verification-workflow" });
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
              return {
                success: true,
                data: { verified: true, method: "dns_txt" },
              };
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

  return {
    success: true,
    data: { verified: false, method: null },
  };
}

/**
 * Step: Verify domain ownership via HTML file.
 *
 * Supports two methods (checked in order):
 * 1. Per-token file: /.well-known/domainstack-verify/{token}.html
 * 2. Legacy single file: /.well-known/domainstack-verify.html
 *
 * File contents must match: "domainstack-verify: TOKEN"
 */
async function verifyByHtmlFile(
  domain: string,
  token: string,
): Promise<VerificationWorkflowResult> {
  "use step";

  const { HTML_FILE_DIR, HTML_FILE_PATH_LEGACY, HTML_FILE_CONTENT_PREFIX } =
    await import("@/lib/constants/verification");
  const { fetchRemoteAsset } = await import("@/lib/fetch-remote-asset");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "verification-workflow" });
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
        return {
          success: true,
          data: { verified: true, method: "html_file" },
        };
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
        return {
          success: true,
          data: { verified: true, method: "html_file" },
        };
      }
    } catch (err) {
      logger.warn(
        { err, domain, url: urlStr },
        "Legacy HTML file verification failed",
      );
    }
  }

  return {
    success: true,
    data: { verified: false, method: null },
  };
}

/**
 * Step: Verify domain ownership via meta tag.
 *
 * Expected tag: <meta name="domainstack-verify" content="TOKEN">
 *
 * Uses cheerio for robust HTML parsing.
 * Checks ALL verification meta tags to support multiple users tracking the same domain.
 */
async function verifyByMetaTag(
  domain: string,
  token: string,
): Promise<VerificationWorkflowResult> {
  "use step";

  const { META_TAG_NAME } = await import("@/lib/constants/verification");
  const { fetchRemoteAsset } = await import("@/lib/fetch-remote-asset");
  const { createLogger } = await import("@/lib/logger/server");
  const cheerio = await import("cheerio");

  const logger = createLogger({ source: "verification-workflow" });

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
        return {
          success: true,
          data: { verified: true, method: "meta_tag" },
        };
      }
    } catch (err) {
      logger.warn({ err, domain, url: urlStr }, "Meta tag verification failed");
    }
  }

  return {
    success: true,
    data: { verified: false, method: null },
  };
}

/**
 * Generate a secure verification token.
 * This is a pure function that doesn't need to be a workflow step.
 */
export function generateVerificationToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
