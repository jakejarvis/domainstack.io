import { describe, expect, it } from "vitest";

import {
  applyCertificateDampening,
  detectCertificateChange,
  detectProviderChange,
  detectRegistrationChange,
  evaluateCertificateChange,
} from "./detection";
import type { CertificateSnapshotData } from "./types";

describe("detectRegistrationChange", () => {
  const baseSnapshot = {
    registrarProviderId: "registrar-1",
    nameservers: [{ host: "ns1.example.com" }, { host: "ns2.example.com" }],
    transferLock: true,
    statuses: ["active", "clientTransferProhibited"],
  };

  it("returns null when nothing changed", () => {
    const result = detectRegistrationChange(baseSnapshot, { ...baseSnapshot });
    expect(result).toBeNull();
  });

  it("detects registrar change", () => {
    const current = { ...baseSnapshot, registrarProviderId: "registrar-2" };
    const result = detectRegistrationChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.registrarChanged).toBe(true);
    expect(result?.previousRegistrar).toBe("registrar-1");
    expect(result?.newRegistrar).toBe("registrar-2");
  });

  it("detects nameserver change", () => {
    const current = {
      ...baseSnapshot,
      nameservers: [{ host: "ns1.new.com" }, { host: "ns2.new.com" }],
    };
    const result = detectRegistrationChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.nameserversChanged).toBe(true);
    expect(result?.previousNameservers).toEqual(baseSnapshot.nameservers);
    expect(result?.newNameservers).toEqual(current.nameservers);
  });

  it("ignores nameserver order differences", () => {
    const current = {
      ...baseSnapshot,
      nameservers: [{ host: "ns2.example.com" }, { host: "ns1.example.com" }],
    };
    const result = detectRegistrationChange(baseSnapshot, current);
    expect(result).toBeNull();
  });

  it("ignores nameserver case differences (RFC 4343)", () => {
    const current = {
      ...baseSnapshot,
      nameservers: [{ host: "NS1.EXAMPLE.COM" }, { host: "NS2.EXAMPLE.COM" }],
    };
    const result = detectRegistrationChange(baseSnapshot, current);
    expect(result).toBeNull();
  });

  it("detects transfer lock change", () => {
    const current = { ...baseSnapshot, transferLock: false };
    const result = detectRegistrationChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.transferLockChanged).toBe(true);
    expect(result?.previousTransferLock).toBe(true);
    expect(result?.newTransferLock).toBe(false);
  });

  it("detects status change with different formatting", () => {
    const current = {
      ...baseSnapshot,
      statuses: ["active", "serverHold"],
    };
    const result = detectRegistrationChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.statusesChanged).toBe(true);
  });

  it("handles status formatting differences as equal", () => {
    const current = {
      ...baseSnapshot,
      statuses: ["active", "client transfer prohibited"],
    };
    const result = detectRegistrationChange(baseSnapshot, current);
    expect(result).toBeNull();
  });

  it("handles empty arrays", () => {
    const empty = {
      registrarProviderId: null,
      nameservers: [],
      transferLock: null,
      statuses: [],
    };
    const result = detectRegistrationChange(empty, empty);
    expect(result).toBeNull();
  });
});

describe("detectProviderChange", () => {
  const baseSnapshot = {
    dnsProviderId: "dns-1",
    hostingProviderId: "hosting-1",
    emailProviderId: "email-1",
  };

  it("returns null when nothing changed", () => {
    const result = detectProviderChange(baseSnapshot, { ...baseSnapshot });
    expect(result).toBeNull();
  });

  it("detects DNS provider change", () => {
    const current = { ...baseSnapshot, dnsProviderId: "dns-2" };
    const result = detectProviderChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.dnsProviderChanged).toBe(true);
    expect(result?.previousDnsProviderId).toBe("dns-1");
    expect(result?.newDnsProviderId).toBe("dns-2");
  });

  it("detects hosting provider change", () => {
    const current = { ...baseSnapshot, hostingProviderId: "hosting-2" };
    const result = detectProviderChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.hostingProviderChanged).toBe(true);
  });

  it("detects email provider change", () => {
    const current = { ...baseSnapshot, emailProviderId: "email-2" };
    const result = detectProviderChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.emailProviderChanged).toBe(true);
  });

  it("detects multiple provider changes", () => {
    const current = {
      dnsProviderId: "dns-2",
      hostingProviderId: "hosting-2",
      emailProviderId: "email-2",
    };
    const result = detectProviderChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.dnsProviderChanged).toBe(true);
    expect(result?.hostingProviderChanged).toBe(true);
    expect(result?.emailProviderChanged).toBe(true);
  });

  it("handles null provider IDs", () => {
    const empty = {
      dnsProviderId: null,
      hostingProviderId: null,
      emailProviderId: null,
    };
    const result = detectProviderChange(empty, empty);
    expect(result).toBeNull();
  });
});

describe("detectCertificateChange", () => {
  const letsEncrypt = "letsencrypt";
  const googleTrust = "google-trust-services";
  const validTo = "2026-03-01T00:00:00.000Z";
  const laterValidTo = "2026-05-01T00:00:00.000Z";
  const fingerprintA = "aaa111bbb222ccc333";
  const fingerprintB = "ddd444eee555fff666";

  const baseSnapshot: CertificateSnapshotData = {
    caProviderId: letsEncrypt,
    issuer: "R10",
    validTo,
    fingerprint: fingerprintA,
    serialNumber: "01",
  };

  it("returns none when leaf identity is unchanged", () => {
    const result = detectCertificateChange(baseSnapshot, { ...baseSnapshot });
    expect(result.kind).toBe("none");
    expect(result.caProviderChanged).toBe(false);
    expect(result.issuerChanged).toBe(false);
  });

  it("returns none for R10 → R11 with the same fingerprint (intermediate rotation)", () => {
    const current: CertificateSnapshotData = {
      ...baseSnapshot,
      issuer: "R11",
    };
    const result = detectCertificateChange(baseSnapshot, current);
    expect(result.kind).toBe("none");
    expect(result.issuerChanged).toBe(true);
    expect(result.caProviderChanged).toBe(false);
  });

  it("returns intermediate for R10 → R11 with no fingerprints and the same validTo", () => {
    const previous: CertificateSnapshotData = {
      caProviderId: letsEncrypt,
      issuer: "R10",
      validTo,
      fingerprint: null,
    };
    const current: CertificateSnapshotData = {
      ...previous,
      issuer: "R11",
    };
    const result = detectCertificateChange(previous, current);
    expect(result.kind).toBe("intermediate");
    expect(result.caProviderChanged).toBe(false);
  });

  it("returns renewal when the same CA issues a new leaf with a later validTo", () => {
    const current: CertificateSnapshotData = {
      ...baseSnapshot,
      issuer: "R11",
      fingerprint: fingerprintB,
      serialNumber: "02",
      validTo: laterValidTo,
    };
    const result = detectCertificateChange(baseSnapshot, current);
    expect(result.kind).toBe("renewal");
    expect(result.caProviderChanged).toBe(false);
  });

  it("returns reissue when the same CA issues a new leaf without moving validTo forward", () => {
    const current: CertificateSnapshotData = {
      ...baseSnapshot,
      fingerprint: fingerprintB,
      serialNumber: "02",
    };
    const result = detectCertificateChange(baseSnapshot, current);
    expect(result.kind).toBe("reissue");
  });

  it("returns reissue when validTo moves backward", () => {
    const current: CertificateSnapshotData = {
      ...baseSnapshot,
      fingerprint: fingerprintB,
      validTo: "2026-01-01T00:00:00.000Z",
    };
    const result = detectCertificateChange(baseSnapshot, current);
    expect(result.kind).toBe("reissue");
  });

  it("returns authority when Let's Encrypt is replaced by Google Trust Services", () => {
    const current: CertificateSnapshotData = {
      ...baseSnapshot,
      caProviderId: googleTrust,
      issuer: "WE1",
      fingerprint: fingerprintB,
      validTo: laterValidTo,
    };
    const result = detectCertificateChange(baseSnapshot, current);
    expect(result.kind).toBe("authority");
    expect(result.caProviderChanged).toBe(true);
    expect(result.previousCaProviderId).toBe(letsEncrypt);
    expect(result.newCaProviderId).toBe(googleTrust);
  });

  it("does not treat null → letsencrypt as an authority change", () => {
    const previous: CertificateSnapshotData = {
      caProviderId: null,
      issuer: "R10",
      validTo,
      fingerprint: fingerprintA,
      serialNumber: "01",
    };
    const current: CertificateSnapshotData = {
      ...previous,
      caProviderId: letsEncrypt,
    };
    const result = detectCertificateChange(previous, current);
    expect(result.kind).not.toBe("authority");
    expect(result.caProviderChanged).toBe(false);
    expect(result.kind).toBe("none");
  });

  it("degrades to renewal when fingerprints are missing and validTo moved forward", () => {
    const previous: CertificateSnapshotData = {
      caProviderId: letsEncrypt,
      issuer: "R10",
      validTo,
      fingerprint: null,
    };
    const current: CertificateSnapshotData = {
      ...previous,
      issuer: "R11",
      validTo: laterValidTo,
    };
    const result = detectCertificateChange(previous, current);
    expect(result.kind).toBe("renewal");
  });

  it("returns none for identical empty snapshots", () => {
    const empty: CertificateSnapshotData = {
      caProviderId: null,
      issuer: "",
      validTo: "",
      fingerprint: null,
    };
    const result = detectCertificateChange(empty, empty);
    expect(result.kind).toBe("none");
  });
});

describe("applyCertificateDampening", () => {
  const t0 = new Date("2026-01-01T00:00:00.000Z");
  const t1 = new Date("2026-01-01T01:00:00.000Z");
  const t2 = new Date("2026-01-01T02:00:00.000Z");
  const t3 = new Date("2026-01-01T03:00:00.000Z");

  const certA: CertificateSnapshotData = {
    caProviderId: "letsencrypt",
    issuer: "R10",
    validTo: "2026-03-01T00:00:00.000Z",
    fingerprint: "aaa111",
    serialNumber: "01",
  };

  const certB: CertificateSnapshotData = {
    caProviderId: "letsencrypt",
    issuer: "R11",
    validTo: "2026-05-01T00:00:00.000Z",
    fingerprint: "bbb222",
    serialNumber: "02",
  };

  it("does not notify on the first A → B observation", () => {
    const kind = detectCertificateChange(certA, certB).kind;
    const result = applyCertificateDampening(certA, certB, kind, t0);

    expect(kind).toBe("renewal");
    expect(result.shouldNotify).toBe(false);
    expect(result.snapshot?.fingerprint).toBe("aaa111");
    expect(result.snapshot?.pending?.observations).toBe(1);
    expect(result.snapshot?.pending?.fingerprint).toBe("bbb222");
  });

  it("notifies once after A → B → B confirmation", () => {
    const first = applyCertificateDampening(certA, certB, "renewal", t0);
    const second = applyCertificateDampening(first.snapshot!, certB, "renewal", t1);

    expect(second.shouldNotify).toBe(true);
    expect(second.snapshot?.fingerprint).toBe("bbb222");
    expect(second.snapshot?.pending).toBeNull();
  });

  it("clears pending and notifies nothing on A → B → A revert", () => {
    const pending = applyCertificateDampening(certA, certB, "renewal", t0);
    const reverted = applyCertificateDampening(pending.snapshot!, certA, "none", t1);

    expect(reverted.shouldNotify).toBe(false);
    expect(reverted.snapshot?.pending).toBeNull();
    expect(reverted.snapshot?.fingerprint).toBe("aaa111");
  });

  it("suppresses A → B → A → B via flap memory", () => {
    const firstB = applyCertificateDampening(certA, certB, "renewal", t0);
    const confirmedB = applyCertificateDampening(firstB.snapshot!, certB, "renewal", t1);
    expect(confirmedB.shouldNotify).toBe(true);

    const t4 = new Date("2026-01-01T04:00:00.000Z");
    const t5 = new Date("2026-01-01T05:00:00.000Z");

    const firstA = applyCertificateDampening(confirmedB.snapshot!, certA, "reissue", t2);
    expect(firstA.shouldNotify).toBe(false);

    const confirmedA = applyCertificateDampening(firstA.snapshot!, certA, "reissue", t3);
    expect(confirmedA.shouldNotify).toBe(false);
    expect(confirmedA.snapshot?.fingerprint).toBe("aaa111");
    expect(confirmedA.snapshot?.pending).toBeNull();

    const secondB = applyCertificateDampening(confirmedA.snapshot!, certB, "renewal", t4);
    const confirmedSecondB = applyCertificateDampening(secondB.snapshot!, certB, "renewal", t5);
    expect(confirmedSecondB.shouldNotify).toBe(false);
    expect(confirmedSecondB.snapshot?.fingerprint).toBe("bbb222");
  });

  it("commits intermediate issuer rotation silently", () => {
    const previous: CertificateSnapshotData = {
      caProviderId: "letsencrypt",
      issuer: "R10",
      validTo: certA.validTo,
      fingerprint: null,
    };
    const current: CertificateSnapshotData = {
      ...previous,
      issuer: "R11",
      fingerprint: "abc123",
    };
    const result = applyCertificateDampening(previous, current, "intermediate", t0);

    expect(result.shouldNotify).toBe(false);
    expect(result.snapshot?.issuer).toBe("R11");
    expect(result.snapshot?.fingerprint).toBe("abc123");
    expect(result.snapshot?.pending).toBeNull();
  });

  it("backfills a missing fingerprint on none without notifying", () => {
    const previous: CertificateSnapshotData = {
      ...certA,
      fingerprint: null,
      serialNumber: null,
    };
    const current: CertificateSnapshotData = { ...certA };
    const result = applyCertificateDampening(previous, current, "none", t0);

    expect(result.shouldNotify).toBe(false);
    expect(result.snapshot?.fingerprint).toBe("aaa111");
    expect(result.snapshot?.serialNumber).toBe("01");
  });
});

describe("evaluateCertificateChange", () => {
  const t0 = new Date("2026-01-01T00:00:00.000Z");
  const t1 = new Date("2026-01-01T01:00:00.000Z");

  const certA: CertificateSnapshotData = {
    caProviderId: "letsencrypt",
    issuer: "R10",
    validTo: "2026-03-01T00:00:00.000Z",
    fingerprint: "aaa111",
    serialNumber: "01",
  };

  const certB: CertificateSnapshotData = {
    caProviderId: "letsencrypt",
    issuer: "R11",
    validTo: "2026-05-01T00:00:00.000Z",
    fingerprint: "bbb222",
    serialNumber: "02",
  };

  it("returns a snapshot to commit when a change is confirmed, independent of delivery", () => {
    const first = evaluateCertificateChange(certA, certB, t0);
    expect(first.shouldNotify).toBe(false);
    expect(first.snapshotToWrite).not.toBeNull();

    const second = evaluateCertificateChange(first.snapshotToWrite!, certB, t1);
    expect(second.shouldNotify).toBe(true);
    expect(second.snapshotToWrite).not.toBeNull();
    expect(second.snapshotToWrite?.fingerprint).toBe("bbb222");
  });

  it("does not touch the snapshot when nothing changed", () => {
    const result = evaluateCertificateChange(certA, certA, t0);
    expect(result.kind).toBe("none");
    expect(result.shouldNotify).toBe(false);
    expect(result.snapshotToWrite).toBeNull();
  });
});
