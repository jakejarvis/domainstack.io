/* @vitest-environment node */
import type { Certificate } from "node:tls";

import { describe, expect, it } from "vitest";

import {
  cyclicChain,
  incompleteChain,
  incompleteChainWithSharedCn,
  noCertificate,
  selfSignedCertificate,
  selfSignedCertificateWithRepeatedOu,
  validChain,
} from "./fixtures";
import {
  isEmptyPeerCertificate,
  isExpectedTlsError,
  parseAltNames,
  parseCertificateDate,
  toName,
  walkCertificateChain,
} from "./utils";

// Helper to cast partial objects as Certificate for testing
const asCert = (obj: Partial<Certificate>) => obj as Certificate;

describe("toName", () => {
  it("returns empty string for undefined", () => {
    expect(toName(undefined)).toBe("");
  });

  it("prefers CN over O", () => {
    expect(toName(asCert({ CN: "Common Name", O: "Organization" }))).toBe("Common Name");
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

describe("parseCertificateDate", () => {
  it("returns null for invalid dates", () => {
    expect(parseCertificateDate("not-a-date")).toBeNull();
    expect(parseCertificateDate("")).toBeNull();
    expect(parseCertificateDate(undefined)).toBeNull();
  });

  it("parses OpenSSL-style certificate dates", () => {
    const date = parseCertificateDate("Jan  1 00:00:00 2024 GMT");
    expect(date?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("isEmptyPeerCertificate", () => {
  it("treats an empty object as no certificate", () => {
    expect(isEmptyPeerCertificate(noCertificate())).toBe(true);
  });

  it("accepts a presented certificate", () => {
    expect(isEmptyPeerCertificate(validChain())).toBe(false);
  });
});

describe("walkCertificateChain", () => {
  it("assigns leaf-first chain positions", () => {
    const { chain, chainComplete } = walkCertificateChain(validChain() as never);
    expect(chain.map((c) => c.chainPosition)).toEqual([0, 1, 2]);
    expect(chainComplete).toBe(true);
  });

  it("marks a self-signed leaf as a complete chain", () => {
    const { chain, chainComplete } = walkCertificateChain(selfSignedCertificate() as never);
    expect(chain).toHaveLength(1);
    expect(chainComplete).toBe(true);
  });

  it("marks a self-signed leaf with repeated DN attributes as a complete chain", () => {
    const { chain, chainComplete } = walkCertificateChain(
      selfSignedCertificateWithRepeatedOu() as never,
    );
    expect(chain).toHaveLength(1);
    expect(chainComplete).toBe(true);
  });

  it("marks a missing root as incomplete", () => {
    const { chain, chainComplete } = walkCertificateChain(incompleteChain() as never);
    expect(chain).toHaveLength(2);
    expect(chainComplete).toBe(false);
  });

  it("does not treat a shared CN as a complete chain when other DN attributes differ", () => {
    const { chainComplete } = walkCertificateChain(incompleteChainWithSharedCn() as never);
    expect(chainComplete).toBe(false);
  });

  it("stops multi-node fingerprint cycles", () => {
    const { chain, chainComplete } = walkCertificateChain(cyclicChain() as never);
    expect(chain).toHaveLength(2);
    expect(chainComplete).toBe(false);
  });
});
