import { describe, expect, it } from "vitest";

import {
  DNS_VERIFICATION_PREFIX,
  DNS_VERIFICATION_TTL,
  DNS_VERIFICATION_TTL_LABEL,
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  META_TAG_NAME,
} from "@domainstack/constants";

import {
  buildVerificationInstructions,
  isValidVerificationMethod,
} from "./verification-instructions";

const domain = "example.com";
const token = "abc123";

describe("buildVerificationInstructions", () => {
  const instructions = buildVerificationInstructions(domain, token);

  it("builds DNS TXT instructions", () => {
    expect(instructions.dns_txt).toEqual({
      title: "Recommended: Add a DNS record",
      description:
        "Add the following TXT record to your domain's DNS root. Changes may take a few minutes to propagate, but this is the most reliable method.",
      hostname: domain,
      recordType: "TXT",
      value: `${DNS_VERIFICATION_PREFIX}${token}`,
      suggestedTTL: DNS_VERIFICATION_TTL,
      suggestedTTLLabel: DNS_VERIFICATION_TTL_LABEL,
    });
  });

  it("builds HTML file instructions", () => {
    expect(instructions.html_file).toEqual({
      title: "Upload an HTML file",
      description:
        "Create a file at the following path with the contents shown below. The file must remain publicly accessible.",
      hostname: domain,
      fullPath: `${HTML_FILE_DIR}/${token}.html`,
      filename: `${token}.html`,
      fileContent: `${HTML_FILE_CONTENT_PREFIX}${token}`,
    });
  });

  it("builds meta tag instructions", () => {
    expect(instructions.meta_tag).toEqual({
      title: "Add a meta tag",
      description: "Add the following meta tag to the <head> section of your homepage.",
      metaTag: `<meta name="${META_TAG_NAME}" content="${token}">`,
    });
  });
});

describe("isValidVerificationMethod", () => {
  it("accepts known methods", () => {
    expect(isValidVerificationMethod("dns_txt")).toBe(true);
    expect(isValidVerificationMethod("html_file")).toBe(true);
    expect(isValidVerificationMethod("meta_tag")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isValidVerificationMethod("nope")).toBe(false);
    expect(isValidVerificationMethod("")).toBe(false);
    expect(isValidVerificationMethod(null)).toBe(false);
    expect(isValidVerificationMethod(1)).toBe(false);
  });
});
