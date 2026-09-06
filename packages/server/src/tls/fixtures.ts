/**
 * Deterministic TLS peer-certificate fixtures for unit tests.
 *
 * These mimic Node's `getPeerCertificate(true)` objects. They are not live
 * BadSSL targets — network-dependent checks stay out of the automated suite.
 */

export interface PeerCertificateFixture {
  issuer: { CN?: string; O?: string; C?: string };
  subject: { CN?: string; O?: string; C?: string };
  subjectaltname?: string;
  valid_from: string;
  valid_to: string;
  fingerprint256: string;
  serialNumber: string;
  bits?: number;
  issuerCertificate?: PeerCertificateFixture | null;
}

const FINGERPRINTS = {
  leaf: "aa".repeat(32),
  intermediate: "bb".repeat(32),
  root: "cc".repeat(32),
  selfSigned: "dd".repeat(32),
  cycleA: "ee".repeat(32),
  cycleB: "ff".repeat(32),
} as const;

function colonate(hex: string): string {
  return hex.match(/.{2}/g)?.join(":").toUpperCase() ?? hex;
}

export const VALID_FROM = "Jan  1 00:00:00 2024 GMT";
export const VALID_TO = "Jan  1 00:00:00 2026 GMT";
export const EXPIRED_TO = "Jan  1 00:00:00 2020 GMT";
export const EXPIRED_FROM = "Jan  1 00:00:00 2018 GMT";

export function createRootCertificate(
  overrides: Partial<PeerCertificateFixture> = {},
): PeerCertificateFixture {
  const root: PeerCertificateFixture = {
    issuer: { CN: "Test Root CA", O: "Test", C: "US" },
    subject: { CN: "Test Root CA", O: "Test", C: "US" },
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.root),
    serialNumber: "01",
    bits: 4096,
    ...overrides,
  };
  root.issuerCertificate = root;
  return root;
}

export function createIntermediateCertificate(
  root: PeerCertificateFixture = createRootCertificate(),
  overrides: Partial<PeerCertificateFixture> = {},
): PeerCertificateFixture {
  return {
    issuer: { CN: "Test Root CA", O: "Test", C: "US" },
    subject: { CN: "Test Intermediate CA", O: "Test", C: "US" },
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.intermediate),
    serialNumber: "02",
    bits: 2048,
    issuerCertificate: root,
    ...overrides,
  };
}

export function createLeafCertificate(
  intermediate: PeerCertificateFixture = createIntermediateCertificate(),
  overrides: Partial<PeerCertificateFixture> = {},
): PeerCertificateFixture {
  return {
    issuer: { CN: "Test Intermediate CA", O: "Test", C: "US" },
    subject: { CN: "example.com" },
    subjectaltname: "DNS:example.com, DNS:www.example.com",
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.leaf),
    serialNumber: "03",
    bits: 256,
    issuerCertificate: intermediate,
    ...overrides,
  };
}

/** Trusted leaf → intermediate → self-signed root. */
export function validChain(): PeerCertificateFixture {
  return createLeafCertificate();
}

/** Expired leaf that still presents a complete chain. */
export function expiredChain(): PeerCertificateFixture {
  return createLeafCertificate(createIntermediateCertificate(), {
    valid_from: EXPIRED_FROM,
    valid_to: EXPIRED_TO,
  });
}

/** Leaf issued for a different hostname. */
export function wrongHostChain(): PeerCertificateFixture {
  return createLeafCertificate(createIntermediateCertificate(), {
    subject: { CN: "other.example" },
    subjectaltname: "DNS:other.example",
  });
}

/** Self-signed leaf (complete chain of one). */
export function selfSignedCertificate(): PeerCertificateFixture {
  const cert: PeerCertificateFixture = {
    issuer: { CN: "Self Signed" },
    subject: { CN: "Self Signed" },
    subjectaltname: "DNS:example.com",
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.selfSigned),
    serialNumber: "04",
    bits: 2048,
  };
  cert.issuerCertificate = cert;
  return cert;
}

/** Leaf + intermediate with no root (issuer is not self-signed). */
export function incompleteChain(): PeerCertificateFixture {
  const intermediate: PeerCertificateFixture = {
    issuer: { CN: "Missing Root CA" },
    subject: { CN: "Test Intermediate CA" },
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.intermediate),
    serialNumber: "02",
    bits: 2048,
    issuerCertificate: null,
  };
  return createLeafCertificate(intermediate);
}

/** Two-node issuer cycle that must not loop forever. */
export function cyclicChain(): PeerCertificateFixture {
  const nodeA: PeerCertificateFixture = {
    issuer: { CN: "Cycle B" },
    subject: { CN: "Cycle A" },
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.cycleA),
    serialNumber: "0A",
    bits: 2048,
  };
  const nodeB: PeerCertificateFixture = {
    issuer: { CN: "Cycle A" },
    subject: { CN: "Cycle B" },
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
    fingerprint256: colonate(FINGERPRINTS.cycleB),
    serialNumber: "0B",
    bits: 2048,
    issuerCertificate: nodeA,
  };
  nodeA.issuerCertificate = nodeB;
  return nodeA;
}

/** Empty peer certificate object returned when the server presents none. */
export function noCertificate(): Record<string, never> {
  return {};
}

export function malformedDateCertificate(): PeerCertificateFixture {
  return createLeafCertificate(createIntermediateCertificate(), {
    valid_from: "not-a-date",
    valid_to: "also-not-a-date",
  });
}
