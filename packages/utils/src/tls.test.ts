/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { describeTlsValidationError, findLeafCertificate } from "./tls";

describe("describeTlsValidationError", () => {
  it("explains expired certificates", () => {
    expect(describeTlsValidationError("CERT_HAS_EXPIRED")).toEqual({
      title: "Certificate expired",
      description: "The site certificate is past its expiration date and is no longer trusted.",
    });
  });

  it("explains hostname mismatches", () => {
    expect(describeTlsValidationError("ERR_TLS_CERT_ALTNAME_INVALID").title).toBe(
      "Hostname mismatch",
    );
  });

  it("explains self-signed certificates", () => {
    expect(describeTlsValidationError("DEPTH_ZERO_SELF_SIGNED_CERT").title).toBe(
      "Self-signed certificate",
    );
  });

  it("explains untrusted chains", () => {
    expect(describeTlsValidationError("UNABLE_TO_VERIFY_LEAF_SIGNATURE").title).toBe(
      "Untrusted certificate chain",
    );
  });

  it("falls back for unknown codes while callers keep the original code", () => {
    expect(describeTlsValidationError("SOME_NEW_OPENSSL_CODE")).toEqual({
      title: "Invalid certificate",
      description: "The security certificate for this site could not be validated.",
    });
  });

  it("falls back for null", () => {
    expect(describeTlsValidationError(null).title).toBe("Invalid certificate");
  });
});

describe("findLeafCertificate", () => {
  it("selects chainPosition 0 rather than array order", () => {
    const chain = [
      { chainPosition: 1, subject: "Intermediate" },
      { chainPosition: 0, subject: "example.com" },
      { chainPosition: 2, subject: "Root" },
    ];
    expect(findLeafCertificate(chain)?.subject).toBe("example.com");
  });

  it("returns undefined when no leaf is present", () => {
    expect(findLeafCertificate([{ chainPosition: 1, subject: "Intermediate" }])).toBeUndefined();
  });
});
