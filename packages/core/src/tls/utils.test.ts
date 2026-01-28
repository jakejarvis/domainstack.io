/* @vitest-environment node */
import type { Certificate } from "node:tls";
import { describe, expect, it } from "vitest";
import {
  isExpectedDnsError,
  isExpectedTlsError,
  parseAltNames,
  toName,
} from "./utils";

// Helper to cast partial objects as Certificate for testing
const asCert = (obj: Partial<Certificate>) => obj as Certificate;

describe("toName", () => {
  it("returns empty string for undefined", () => {
    expect(toName(undefined)).toBe("");
  });

  it("prefers CN over O", () => {
    expect(toName(asCert({ CN: "Common Name", O: "Organization" }))).toBe(
      "Common Name",
    );
  });

  it("falls back to O when CN is missing", () => {
    expect(toName(asCert({ O: "Organization" }))).toBe("Organization");
  });

  it("stringifies when neither CN nor O is available", () => {
    const cert = asCert({ OU: "Unit" });
    expect(toName(cert)).toBe(JSON.stringify(cert));
  });
});

describe("parseAltNames", () => {
  it("returns empty array for undefined", () => {
    expect(parseAltNames(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAltNames("")).toEqual([]);
  });

  it("parses DNS entries", () => {
    const result = parseAltNames("DNS:example.com, DNS:www.example.com");
    expect(result).toEqual(["example.com", "www.example.com"]);
  });

  it("parses IP Address entries", () => {
    const result = parseAltNames("IP Address:1.2.3.4, DNS:example.com");
    expect(result).toEqual(["1.2.3.4", "example.com"]);
  });

  it("filters out URI entries", () => {
    const result = parseAltNames("DNS:example.com, URI:http://example.com/crl");
    expect(result).toEqual(["example.com"]);
  });

  it("is case-insensitive for type prefix", () => {
    const result = parseAltNames("dns:example.com, Dns:www.example.com");
    expect(result).toEqual(["example.com", "www.example.com"]);
  });
});

describe("isExpectedTlsError", () => {
  it("returns false for non-Error values", () => {
    expect(isExpectedTlsError("error")).toBe(false);
    expect(isExpectedTlsError(null)).toBe(false);
    expect(isExpectedTlsError(undefined)).toBe(false);
  });

  it("detects TLS certificate errors by code", () => {
    const err = new Error("TLS error");
    (err as unknown as { code: string }).code = "ERR_TLS_CERT_ALTNAME_INVALID";
    expect(isExpectedTlsError(err)).toBe(true);
  });

  it("detects expired certificate by code", () => {
    const err = new Error("Certificate expired");
    (err as unknown as { code: string }).code = "CERT_HAS_EXPIRED";
    expect(isExpectedTlsError(err)).toBe(true);
  });

  it("detects TLS errors by message", () => {
    const err = new Error("SSL handshake failed");
    expect(isExpectedTlsError(err)).toBe(true);
  });

  it("detects certificate errors by message", () => {
    const err = new Error("Certificate validation failed");
    expect(isExpectedTlsError(err)).toBe(true);
  });
});

describe("isExpectedDnsError", () => {
  it("returns false for non-Error values", () => {
    expect(isExpectedDnsError("error")).toBe(false);
    expect(isExpectedDnsError(null)).toBe(false);
  });

  it("detects ENOTFOUND errors", () => {
    const err = new Error("DNS error");
    (err as unknown as { code: string }).code = "ENOTFOUND";
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects EAI_AGAIN errors", () => {
    const err = new Error("DNS error");
    (err as unknown as { code: string }).code = "EAI_AGAIN";
    expect(isExpectedDnsError(err)).toBe(true);
  });

  it("detects getaddrinfo errors by message", () => {
    const err = new Error("getaddrinfo ENOTFOUND example.com");
    expect(isExpectedDnsError(err)).toBe(true);
  });
});
