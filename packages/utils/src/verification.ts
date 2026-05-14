import {
  DNS_VERIFICATION_PREFIX,
  DNS_VERIFICATION_TTL,
  DNS_VERIFICATION_TTL_LABEL,
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  META_TAG_NAME,
  VERIFICATION_METHODS,
  type VerificationMethod,
} from "@domainstack/constants";
import type {
  DnsInstructions,
  HtmlFileInstructions,
  MetaTagInstructions,
  VerificationInstructions,
} from "@domainstack/types";

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
        description: "Add the following meta tag to the <head> section of your homepage.",
        metaTag: `<meta name="${META_TAG_NAME}" content="${token}">`,
      };
  }
}

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

export function isValidVerificationMethod(value: unknown): value is VerificationMethod {
  return typeof value === "string" && VERIFICATION_METHODS.includes(value as VerificationMethod);
}

export function formatInstructionsForSharing(domain: string, verificationToken: string): string {
  const { dns_txt, html_file, meta_tag } = buildVerificationInstructions(domain, verificationToken);

  return `Domain Verification Instructions for ${domain}
${"=".repeat(50)}

Please complete ONE of the following verification methods to verify ownership of ${domain}.

${"─".repeat(50)}
OPTION 1: DNS TXT Record (Recommended)
${"─".repeat(50)}
Add a TXT record to your domain's DNS settings:

  Host/Name:  @ (${dns_txt.hostname})
  Type:       ${dns_txt.recordType}
  Value:      ${dns_txt.value}
  TTL:        ${dns_txt.suggestedTTL} (${dns_txt.suggestedTTLLabel})

Note: DNS changes may take up to 48 hours to propagate.

${"─".repeat(50)}
OPTION 2: HTML File Upload
${"─".repeat(50)}
Upload a file to your website:

  File Path:     ${html_file.fullPath}
  File Name:     ${html_file.filename}
  File Contents: ${html_file.fileContent}

The file must be accessible at: https://${domain}${html_file.fullPath}

${"─".repeat(50)}
OPTION 3: Meta Tag
${"─".repeat(50)}
Add this meta tag to your homepage's <head> section:

  ${meta_tag.metaTag}

${"─".repeat(50)}

Once completed, return to Domainstack to verify ownership.
`;
}
