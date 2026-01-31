import { describe, expect, it } from "vitest";
import {
  detectCertificateChange,
  detectProviderChange,
  detectRegistrationChange,
} from "./detection";

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
  const baseSnapshot = {
    caProviderId: "ca-1",
    issuer: "Let's Encrypt Authority X3",
  };

  it("returns null when nothing changed", () => {
    const result = detectCertificateChange(baseSnapshot, { ...baseSnapshot });
    expect(result).toBeNull();
  });

  it("detects CA provider change", () => {
    const current = { ...baseSnapshot, caProviderId: "ca-2" };
    const result = detectCertificateChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.caProviderChanged).toBe(true);
    expect(result?.previousCaProviderId).toBe("ca-1");
    expect(result?.newCaProviderId).toBe("ca-2");
  });

  it("detects issuer change", () => {
    const current = { ...baseSnapshot, issuer: "DigiCert SHA2" };
    const result = detectCertificateChange(baseSnapshot, current);

    expect(result).not.toBeNull();
    expect(result?.issuerChanged).toBe(true);
    expect(result?.previousIssuer).toBe("Let's Encrypt Authority X3");
    expect(result?.newIssuer).toBe("DigiCert SHA2");
  });

  it("handles null values", () => {
    const empty = { caProviderId: null, issuer: null };
    const result = detectCertificateChange(empty, empty);
    expect(result).toBeNull();
  });
});
