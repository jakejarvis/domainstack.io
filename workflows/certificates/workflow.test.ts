/* @vitest-environment node */
import type * as tls from "node:tls";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Hoist TLS mock
const tlsMock = vi.hoisted(() => ({
  socketMock: null as unknown as tls.TLSSocket,
  callListener: true,
}));

vi.mock("node:tls", async () => {
  const actual = await vi.importActual<typeof import("node:tls")>("node:tls");
  const mockedConnect = ((...args: unknown[]) => {
    const listener = args.find((a) => typeof a === "function") as
      | (() => void)
      | undefined;
    const sock = tlsMock.socketMock as tls.TLSSocket;
    if (tlsMock.callListener) {
      setTimeout(() => listener?.(), 0);
    }
    return sock;
  }) as unknown as typeof actual.connect;
  return {
    ...actual,
    connect: mockedConnect,
    default: { ...(actual as object), connect: mockedConnect },
  };
});

// Mock provider catalog
vi.mock("@/lib/providers/catalog", () => ({
  getProviders: vi.fn().mockResolvedValue([
    {
      name: "Let's Encrypt",
      domain: "letsencrypt.org",
      category: "ca",
      rule: { kind: "issuerIncludes", substr: "let's encrypt" },
    },
  ]),
}));

// Mock provider detection
vi.mock("@/lib/providers/detection", () => ({
  detectCertificateAuthority: vi.fn((issuer: string) => {
    if (issuer.toLowerCase().includes("let's encrypt")) {
      return {
        name: "Let's Encrypt",
        domain: "letsencrypt.org",
        category: "ca" as const,
      };
    }
    return null;
  }),
}));

// Mock DNS/TLS error detection
vi.mock("@/lib/dns-utils", () => ({
  isExpectedDnsError: vi.fn((err: Error) => {
    return err.message.includes("ENOTFOUND");
  }),
}));

vi.mock("@/lib/fetch", () => ({
  isExpectedTlsError: vi.fn((err: Error) => {
    return (
      err.message.includes("CERT_HAS_EXPIRED") ||
      err.message.includes("self-signed")
    );
  }),
}));

function makePeerCert(
  partial: Partial<tls.DetailedPeerCertificate>,
): tls.DetailedPeerCertificate {
  return {
    subject: {
      CN: "example.com",
    } as unknown as tls.PeerCertificate["subject"],
    issuer: {
      O: "Let's Encrypt",
    } as unknown as tls.PeerCertificate["issuer"],
    valid_from: "Jan 1 00:00:00 2039 GMT",
    valid_to: "Apr 1 00:00:00 2039 GMT",
    ...partial,
  } as unknown as tls.DetailedPeerCertificate;
}

describe("certificatesWorkflow step functions", () => {
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@/lib/db/pglite");
    await resetPGliteDb();
    vi.clearAllMocks();
    tlsMock.callListener = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  describe("fetchCertificateChain step", () => {
    it("fetches and parses certificate chain", async () => {
      const leaf = makePeerCert({
        subject: { CN: "example.com" } as tls.PeerCertificate["subject"],
        issuer: { O: "Let's Encrypt" } as tls.PeerCertificate["issuer"],
      });

      const intermediate = makePeerCert({
        subject: { O: "Let's Encrypt" } as tls.PeerCertificate["subject"],
        issuer: { O: "ISRG Root" } as tls.PeerCertificate["issuer"],
      });

      // Create chain with issuerCertificate references
      const chainedLeaf = {
        ...leaf,
        issuerCertificate: {
          ...intermediate,
          issuerCertificate: intermediate, // self-reference to end chain
        },
      };

      tlsMock.socketMock = {
        getPeerCertificate: vi.fn().mockReturnValue(chainedLeaf),
        setTimeout: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      } as unknown as tls.TLSSocket;

      // Create domain first
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      await upsertDomain({
        name: "tls-test.com",
        tld: "com",
        unicodeName: "tls-test.com",
      });

      const { certificatesWorkflow } = await import("./workflow");
      const result = await certificatesWorkflow({ domain: "tls-test.com" });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data.certificates.length).toBeGreaterThan(0);
      expect(result.data.certificates[0].subject).toBe("example.com");
    });

    it("handles DNS errors gracefully", async () => {
      tlsMock.callListener = false;
      let errorHandler: ((err: Error) => void) | undefined;

      tlsMock.socketMock = {
        getPeerCertificate: vi.fn(),
        setTimeout: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "error" && typeof handler === "function") {
            errorHandler = handler as (err: Error) => void;
          }
          return tlsMock.socketMock;
        }),
        destroy: vi.fn(() => {
          errorHandler?.(new Error("ENOTFOUND"));
        }),
      } as unknown as tls.TLSSocket;

      const { certificatesWorkflow } = await import("./workflow");
      const promise = certificatesWorkflow({ domain: "dns-error.invalid" });

      // Trigger the error
      await Promise.resolve();
      setTimeout(() => {
        tlsMock.socketMock.destroy?.(new Error("ENOTFOUND"));
      }, 0);

      const result = await promise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("dns_error");
        expect(result.data?.certificates).toHaveLength(0);
      }
    });

    it("handles TLS errors gracefully", async () => {
      tlsMock.callListener = false;
      let errorHandler: ((err: Error) => void) | undefined;

      tlsMock.socketMock = {
        getPeerCertificate: vi.fn(),
        setTimeout: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "error" && typeof handler === "function") {
            errorHandler = handler as (err: Error) => void;
          }
          return tlsMock.socketMock;
        }),
        destroy: vi.fn(() => {
          errorHandler?.(new Error("CERT_HAS_EXPIRED"));
        }),
      } as unknown as tls.TLSSocket;

      const { certificatesWorkflow } = await import("./workflow");
      const promise = certificatesWorkflow({ domain: "expired-cert.com" });

      await Promise.resolve();
      setTimeout(() => {
        tlsMock.socketMock.destroy?.(new Error("CERT_HAS_EXPIRED"));
      }, 0);

      const result = await promise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("tls_error");
        expect(result.data?.error).toBe("Invalid SSL certificate");
      }
    });
  });

  describe("persistCertificates step", () => {
    it("persists certificates to database for existing domain", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      await upsertDomain({
        name: "persist-cert.com",
        tld: "com",
        unicodeName: "persist-cert.com",
      });

      const leaf = makePeerCert({
        subject: { CN: "persist-cert.com" } as tls.PeerCertificate["subject"],
        issuer: { O: "Let's Encrypt" } as tls.PeerCertificate["issuer"],
      });

      tlsMock.socketMock = {
        getPeerCertificate: vi.fn().mockReturnValue({
          ...leaf,
          issuerCertificate: leaf, // self-reference to end chain
        }),
        setTimeout: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      } as unknown as tls.TLSSocket;

      const { certificatesWorkflow } = await import("./workflow");
      await certificatesWorkflow({ domain: "persist-cert.com" });

      // Verify certificates were persisted
      const { db } = await import("@/lib/db/client");
      const { domains, certificates } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const domainRows = await db
        .select()
        .from(domains)
        .where(eq(domains.name, "persist-cert.com"));

      const certRows = await db
        .select()
        .from(certificates)
        .where(eq(certificates.domainId, domainRows[0].id));

      expect(certRows.length).toBeGreaterThan(0);
      expect(certRows[0].issuer).toBe("Let's Encrypt");
    });
  });
});

describe("certificates helper functions", () => {
  it("toName prefers CN then O then stringifies", async () => {
    const { toName } = await import("./workflow");

    // Cast to the expected TLS Certificate type
    expect(toName({ CN: "example.com" } as tls.Certificate)).toBe(
      "example.com",
    );
    expect(toName({ O: "Organization" } as tls.Certificate)).toBe(
      "Organization",
    );
    expect(toName({ X: "Unknown" } as unknown as tls.Certificate)).toContain(
      "X",
    );
    expect(toName(undefined)).toBe("");
  });

  it("parseAltNames extracts DNS and IP values", async () => {
    const { parseAltNames } = await import("./workflow");

    expect(
      parseAltNames("DNS:example.com, DNS:www.example.com, IP Address:1.2.3.4"),
    ).toEqual(["example.com", "www.example.com", "1.2.3.4"]);

    expect(parseAltNames("URI:http://example.com")).toEqual([]);
    expect(parseAltNames(undefined)).toEqual([]);
    expect(parseAltNames("")).toEqual([]);
  });
});
