/**
 * Certificate utility functions - pure helper functions for certificate processing.
 *
 * These functions have no database or network dependencies and can be safely
 * imported without side effects.
 */

import type { Certificate as TlsCertificate } from "node:tls";

/**
 * Convert a TLS certificate name field to a string.
 *
 * Prefers CN (Common Name), falls back to O (Organization), then stringifies.
 */
export function toName(subject: TlsCertificate | undefined): string {
  if (!subject) return "";
  const cn = typeof subject.CN === "string" ? subject.CN : undefined;
  const o = typeof subject.O === "string" ? subject.O : undefined;
  return cn ? cn : o ? o : JSON.stringify(subject);
}

/**
 * Parse subject alternative names from a certificate.
 *
 * Extracts DNS and IP Address entries, filters out other types (like URI).
 */
export function parseAltNames(subjectAltName: string | undefined): string[] {
  if (typeof subjectAltName !== "string" || subjectAltName.length === 0) {
    return [];
  }
  return subjectAltName
    .split(",")
    .map((segment) => segment.trim())
    .map((segment) => {
      const idx = segment.indexOf(":");
      if (idx === -1) return ["", segment] as const;
      const kind = segment.slice(0, idx).trim().toUpperCase();
      const value = segment.slice(idx + 1).trim();
      return [kind, value] as const;
    })
    .filter(
      ([kind, value]) => !!value && (kind === "DNS" || kind === "IP ADDRESS"),
    )
    .map(([_, value]) => value);
}

/**
 * Check if an error is a TLS/SSL related error from fetch/undici.
 */
export function isExpectedTlsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as unknown as {
    cause?: { code?: string; message?: string };
    code?: string;
    message?: string;
  };
  const code = anyErr?.cause?.code || anyErr?.code;
  const message = (
    anyErr?.cause?.message ||
    anyErr?.message ||
    ""
  ).toLowerCase();

  return (
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    code === "ERR_TLS_CERT_HAS_EXPIRED" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_SSL_PROTOCOL_ERROR" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "ERR_SSL_WRONG_VERSION_NUMBER" ||
    message.includes("certificate") ||
    message.includes("tls") ||
    message.includes("ssl") ||
    message.includes("signed")
  );
}
