/**
 * Certificate utility functions - pure helper functions for certificate processing.
 *
 * These functions have no database or network dependencies and can be safely
 * imported without side effects.
 */

import type { Certificate as TlsCertificate, DetailedPeerCertificate, TLSSocket } from "node:tls";

import { normalizeCertificateHex } from "@domainstack/utils/certificate-hex";

import type { RawCertificate } from "./types";

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
    .filter(([kind, value]) => !!value && (kind === "DNS" || kind === "IP ADDRESS"))
    .map(([, value]) => value);
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
  const message = (anyErr?.cause?.message || anyErr?.message || "").toLowerCase();

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

/**
 * Check if an error is a DNS-related error.
 */
export function isExpectedDnsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as unknown as {
    cause?: { code?: string; message?: string };
    code?: string;
    message?: string;
  };
  const code = anyErr?.cause?.code || anyErr?.code;
  const message = (anyErr?.cause?.message || anyErr?.message || "").toLowerCase();

  return (
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ENODATA" ||
    code === "ENOENT" ||
    message.includes("getaddrinfo") ||
    message.includes("dns")
  );
}

/**
 * Thrown when a peer certificate contains a date that cannot be parsed.
 */
export class InvalidCertificateDateError extends Error {
  readonly name = "InvalidCertificateDateError";

  constructor() {
    super("Certificate contains an invalid date");
  }
}

/**
 * Parse a certificate date before calling `toISOString()`.
 */
export function parseCertificateDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Node returns `{}` when the peer presented no certificate.
 */
export function isEmptyPeerCertificate(peer: object | null | undefined): boolean {
  if (!peer || typeof peer !== "object") return true;
  const cert = peer as Partial<DetailedPeerCertificate>;
  return !cert.raw && !cert.valid_from && !cert.subject && !cert.issuer;
}

function fingerprintOf(cert: DetailedPeerCertificate): string {
  return normalizeCertificateHex(cert.fingerprint256) ?? "";
}

function dnAttributeEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function distinguishedNameEquals(
  left: TlsCertificate | undefined,
  right: TlsCertificate | undefined,
): boolean {
  if (!left || !right) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  if (keys.size === 0) return false;
  for (const key of keys) {
    if (!dnAttributeEquals(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

function isSelfIssued(cert: DetailedPeerCertificate): boolean {
  return distinguishedNameEquals(cert.subject, cert.issuer);
}

/**
 * Walk the issuer chain from the leaf, assigning `chainPosition` and
 * stopping on self-signed roots or fingerprint cycles.
 */
export function walkCertificateChain(peer: DetailedPeerCertificate): {
  chain: RawCertificate[];
  chainComplete: boolean;
} {
  const chain: RawCertificate[] = [];
  const seenFingerprints = new Set<string>();
  const seenObjects = new WeakSet<object>();
  let current: DetailedPeerCertificate | null = peer;
  let chainComplete = false;
  let position = 0;

  while (current) {
    if (seenObjects.has(current)) break;
    seenObjects.add(current);

    const fingerprint256 = fingerprintOf(current);
    if (fingerprint256 && seenFingerprints.has(fingerprint256)) break;
    if (fingerprint256) seenFingerprints.add(fingerprint256);

    const validFrom = parseCertificateDate(current.valid_from);
    const validTo = parseCertificateDate(current.valid_to);
    if (!validFrom || !validTo) {
      throw new InvalidCertificateDateError();
    }

    chain.push({
      issuer: toName(current.issuer),
      subject: toName(current.subject),
      altNames: parseAltNames((current as Partial<{ subjectaltname: string }>).subjectaltname),
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      fingerprint256,
      serialNumber:
        normalizeCertificateHex(
          typeof current.serialNumber === "string" ? current.serialNumber : null,
        ) ?? "",
      chainPosition: position,
    });

    const next: DetailedPeerCertificate | undefined = (
      current as { issuerCertificate?: DetailedPeerCertificate }
    ).issuerCertificate;
    if (!next || next === current) {
      chainComplete = isSelfIssued(current);
      break;
    }

    const nextFingerprint = fingerprintOf(next);
    if (nextFingerprint && nextFingerprint === fingerprint256) {
      chainComplete = isSelfIssued(current);
      break;
    }

    current = next;
    position += 1;
  }

  return { chain, chainComplete };
}

/**
 * Read Node's authorization result without treating it as a fetch failure.
 */
export function readTlsAuthorization(socket: TLSSocket): {
  valid: boolean;
  validationError: string | null;
} {
  if (socket.authorized) {
    return { valid: true, validationError: null };
  }

  const err = socket.authorizationError;
  if (!err) {
    return { valid: false, validationError: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" };
  }
  if (typeof err === "string") {
    return { valid: false, validationError: err };
  }
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    return { valid: false, validationError: code || err.message };
  }
  return { valid: false, validationError: String(err) };
}
