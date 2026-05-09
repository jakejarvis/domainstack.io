import { describe, expect, it } from "vitest";

import { buildVerificationInstructions, isValidVerificationMethod } from "./verification";

describe("verification instructions", () => {
  it("builds DNS, HTML, and meta-tag instructions from shared constants", () => {
    const instructions = buildVerificationInstructions("example.com", "token123");

    expect(instructions.dns_txt.hostname).toBe("example.com");
    expect(instructions.dns_txt.recordType).toBe("TXT");
    expect(instructions.dns_txt.value).toContain("token123");
    expect(instructions.html_file.filename).toBe("token123.html");
    expect(instructions.html_file.fileContent).toContain("token123");
    expect(instructions.meta_tag.metaTag).toContain('content="token123"');
  });

  it("validates supported verification methods", () => {
    expect(isValidVerificationMethod("dns_txt")).toBe(true);
    expect(isValidVerificationMethod("html_file")).toBe(true);
    expect(isValidVerificationMethod("meta_tag")).toBe(true);
    expect(isValidVerificationMethod("txt")).toBe(false);
  });
});
