/**
 * User-facing copy for Node TLS authorization error codes.
 *
 * The stored/API value remains the original code for diagnostics.
 */

export interface TlsValidationCopy {
  title: string;
  description: string;
}

const DEFAULT_COPY: TlsValidationCopy = {
  title: "Invalid certificate",
  description: "The security certificate for this site could not be validated.",
};

const TLS_VALIDATION_COPY: Record<string, TlsValidationCopy> = {
  CERT_HAS_EXPIRED: {
    title: "Certificate expired",
    description: "The site certificate is past its expiration date and is no longer trusted.",
  },
  ERR_TLS_CERT_HAS_EXPIRED: {
    title: "Certificate expired",
    description: "The site certificate is past its expiration date and is no longer trusted.",
  },
  CERT_NOT_YET_VALID: {
    title: "Certificate not yet valid",
    description: "The site certificate's validity period has not started yet.",
  },
  ERR_TLS_CERT_ALTNAME_INVALID: {
    title: "Hostname mismatch",
    description: "The certificate does not match this domain name.",
  },
  DEPTH_ZERO_SELF_SIGNED_CERT: {
    title: "Self-signed certificate",
    description:
      "The certificate is self-signed and is not trusted by public certificate authorities.",
  },
  SELF_SIGNED_CERT_IN_CHAIN: {
    title: "Self-signed certificate",
    description:
      "The certificate chain includes a self-signed certificate that is not publicly trusted.",
  },
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: {
    title: "Untrusted certificate chain",
    description:
      "The certificate chain could not be verified. An intermediate or root certificate may be missing.",
  },
  UNABLE_TO_GET_ISSUER_CERT: {
    title: "Untrusted certificate chain",
    description: "The issuer of the site certificate could not be verified.",
  },
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: {
    title: "Untrusted certificate chain",
    description: "The certificate chain is incomplete, so the issuer could not be verified.",
  },
  CERT_UNTRUSTED: {
    title: "Untrusted certificate chain",
    description: "The certificate is not signed by a trusted certificate authority.",
  },
  CERT_REVOKED: {
    title: "Certificate revoked",
    description: "The certificate has been revoked by its issuer.",
  },
};

/**
 * Map a Node TLS authorization error code to user-facing title and description.
 * Unknown codes fall back to generic copy; the original code is left unchanged.
 */
export function describeTlsValidationError(code: string | null | undefined): TlsValidationCopy {
  if (!code) return DEFAULT_COPY;
  return TLS_VALIDATION_COPY[code] ?? DEFAULT_COPY;
}

/**
 * Select the leaf certificate from a chain by explicit position.
 * Position `0` is the site certificate the owner can renew.
 */
export function findLeafCertificate<T extends { chainPosition: number }>(
  certificates: T[],
): T | undefined {
  return certificates.find((certificate) => certificate.chainPosition === 0);
}
