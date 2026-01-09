import {
  DNS_VERIFICATION_PREFIX,
  DNS_VERIFICATION_TTL,
  DNS_VERIFICATION_TTL_LABEL,
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  META_TAG_NAME,
  VERIFICATION_METHODS,
} from "@/lib/constants/verification";
import type {
  DnsInstructions,
  HtmlFileInstructions,
  MetaTagInstructions,
  VerificationInstructions,
  VerificationMethod,
} from "@/lib/types";

/**
 * Build verification instructions for a single method.
 *
 * IMPORTANT: This must remain client-safe and deterministic.
 * It should never fetch or depend on server-only modules.
 */
function getVerificationInstructions(
  domain: string,
  token: string,
  method: "dns_txt",
): DnsInstructions;
function getVerificationInstructions(
  domain: string,
  token: string,
  method: "html_file",
): HtmlFileInstructions;
function getVerificationInstructions(
  domain: string,
  token: string,
  method: "meta_tag",
): MetaTagInstructions;
function getVerificationInstructions(
  domain: string,
  token: string,
  method: VerificationMethod,
): DnsInstructions | HtmlFileInstructions | MetaTagInstructions {
  switch (method) {
    case "dns_txt":
      return {
        title: "Recommended: Add a DNS record",
        description:
          "Add the following TXT record to your domain's DNS root. Changes may take a few minutes to propagate, but this is the most reliable method.",
        hostname: domain,
        recordType: "TXT",
        value: `${DNS_VERIFICATION_PREFIX}${token}`,
        suggestedTTL: DNS_VERIFICATION_TTL,
        suggestedTTLLabel: DNS_VERIFICATION_TTL_LABEL,
      };
    case "html_file":
      return {
        title: "Upload an HTML file",
        description:
          "Create a file at the following path with the contents shown below. The file must remain publicly accessible.",
        hostname: domain,
        fullPath: `${HTML_FILE_DIR}/${token}.html`,
        filename: `${token}.html`,
        fileContent: `${HTML_FILE_CONTENT_PREFIX}${token}`,
      };
    case "meta_tag":
      return {
        title: "Add a meta tag",
        description:
          "Add the following meta tag to the <head> section of your homepage.",
        metaTag: `<meta name="${META_TAG_NAME}" content="${token}">`,
      };
  }
}

/**
 * Build verification instructions for all supported methods.
 */
export function buildVerificationInstructions(
  domain: string,
  token: string,
): VerificationInstructions {
  return {
    dns_txt: getVerificationInstructions(domain, token, "dns_txt"),
    html_file: getVerificationInstructions(domain, token, "html_file"),
    meta_tag: getVerificationInstructions(domain, token, "meta_tag"),
  };
}

/**
 * Type guard to check if a value is a valid VerificationMethod.
 * Client-safe runtime validation without Zod dependency.
 */
export function isValidVerificationMethod(
  value: unknown,
): value is VerificationMethod {
  return (
    typeof value === "string" &&
    VERIFICATION_METHODS.includes(value as VerificationMethod)
  );
}
