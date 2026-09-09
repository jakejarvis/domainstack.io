import { describe, expect, it } from "vitest";

import { parseArguments, safeFinalUrl, validateUrl } from "./args";
import { classifyError, RunnerError } from "./errors";

const VALID = [
  "--url",
  "https://example.com",
  "--width",
  "1200",
  "--height",
  "630",
  "--format",
  "webp",
  "--output",
  "/tmp/out",
  "--full-page",
  "false",
];

describe("parseArguments", () => {
  it("parses a complete argument list", () => {
    expect(parseArguments(VALID)).toEqual({
      url: "https://example.com",
      width: 1200,
      height: 630,
      format: "webp",
      output: "/tmp/out",
      fullPage: false,
    });
  });

  it.each([
    ["an unpaired flag", ["--url"]],
    ["a positional argument", ["url", "https://example.com"]],
    ["a missing url", VALID.slice(2)],
    ["an unsupported format", [...VALID.slice(0, 7), "gif", ...VALID.slice(8)]],
    ["a non-integer width", [...VALID.slice(0, 3), "12.5", ...VALID.slice(4)]],
    ["an oversized width", [...VALID.slice(0, 3), "7681", ...VALID.slice(4)]],
  ])("rejects %s as invalid_arguments", (_label, argv) => {
    expect(() => parseArguments(argv)).toThrow(RunnerError);
    expect(classifyError(catchError(() => parseArguments(argv)))).toBe("invalid_arguments");
  });
});

describe("validateUrl", () => {
  it("accepts a credential-free HTTPS url", () => {
    expect(validateUrl("https://example.com/a").href).toBe("https://example.com/a");
  });

  // Regression: these once surfaced as `invalid_arguments`, because the parse
  // phase flag was still set while the URL was validated.
  it.each([
    ["malformed", "not-a-url"],
    ["non-HTTPS", "http://example.com"],
    ["credentialed", "https://user:pass@example.com"],
    ["username-only", "https://user@example.com"],
  ])("rejects a %s url as invalid_url", (_label, value) => {
    expect(classifyError(catchError(() => validateUrl(value)))).toBe("invalid_url");
  });
});

describe("safeFinalUrl", () => {
  it("strips credentials, query and hash", () => {
    expect(safeFinalUrl("https://u:p@example.com/a?b=1#c")).toBe("https://example.com/a");
  });

  it("returns null for empty or unparseable input", () => {
    expect(safeFinalUrl(undefined)).toBeNull();
    expect(safeFinalUrl("nonsense")).toBeNull();
  });
});

describe("classifyError", () => {
  it("prefers an explicit runner code over message matching", () => {
    // The message would otherwise be read as a TLS failure.
    const error = new RunnerError("configuration_error", "ssl certificate mismatch");
    expect(classifyError(error)).toBe("configuration_error");
  });

  it.each([
    ["net::ERR_NAME_NOT_RESOLVED at https://x", "dns_error"],
    ["net::ERR_CERT_AUTHORITY_INVALID", "tls_error"],
    ["Navigation timeout of 15000 ms exceeded", "timeout"],
    ["net::ERR_CONNECTION_RESET", "connection_reset"],
    ["Protocol error: Target closed", "browser_crash"],
    ["something entirely unexpected", "capture_failed"],
  ])("maps %s to %s", (message, expected) => {
    expect(classifyError(new Error(message))).toBe(expected);
  });
});

function catchError(fn: () => unknown): unknown {
  try {
    fn();
    throw new Error("expected the call to throw");
  } catch (error) {
    return error;
  }
}
