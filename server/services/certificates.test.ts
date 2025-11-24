/* @vitest-environment node */
import type * as tls from "node:tls";

// Hoisted mock for node:tls to avoid ESM spy limitations
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

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

function makePeer(
  partial: Partial<tls.DetailedPeerCertificate>,
): tls.DetailedPeerCertificate {
  return {
    subject: { CN: "example.com" } as unknown as tls.PeerCertificate["subject"],
    issuer: { O: "Let's Encrypt" } as unknown as tls.PeerCertificate["issuer"],
    valid_from: "Jan 1 00:00:00 2024 GMT",
    valid_to: "Jan 8 00:00:00 2024 GMT",
    ...partial,
  } as unknown as tls.DetailedPeerCertificate;
}

describe("getCertificates", () => {
  it("returns parsed chain and caches", async () => {
    tlsMock.callListener = true;
    const leaf = makePeer({
      subject: {
        CN: "example.com",
      } as unknown as tls.PeerCertificate["subject"],
      issuer: {
        O: "Google Trust Services",
      } as unknown as tls.PeerCertificate["issuer"],
      valid_from: "Jan 1 00:00:00 2039 GMT",
      valid_to: "Jan 8 00:00:00 2040 GMT",
    });
    const issuer = makePeer({
      subject: {
        O: "Google Trust Services",
      } as unknown as tls.PeerCertificate["subject"],
      issuer: {
        O: "DigiCert",
      } as unknown as tls.PeerCertificate["issuer"],
      valid_from: "Jan 1 00:00:00 2039 GMT",
      valid_to: "Jan 8 00:00:00 2040 GMT",
    });

    const getPeerCertificate = vi
      .fn()
      // first call returns a leaf with issuerCertificate reference
      .mockReturnValueOnce({
        ...leaf,
        issuerCertificate: issuer,
      })
      // second call returns issuer with self-reference to stop loop
      .mockReturnValueOnce({
        ...issuer,
        issuerCertificate: issuer,
      });

    tlsMock.socketMock = {
      getPeerCertificate,
      setTimeout: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    } as unknown as tls.TLSSocket;

    // Create domain record first (simulates registered domain)
    const { db } = await import("@/lib/db/client");
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const { domains, certificates, providers } = await import(
      "@/lib/db/schema"
    );
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    const { getCertificates } = await import("./certificates");
    const out = await getCertificates("example.com");
    expect(out.length).toBeGreaterThan(0);

    // Verify DB persistence and CA provider creation
    const { eq } = await import("drizzle-orm");
    const d = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, "example.com"))
      .limit(1);
    const rows = await db
      .select()
      .from(certificates)
      .where(eq(certificates.domainId, d[0].id));
    expect(rows.length).toBeGreaterThan(0);

    // Ensure CA provider rows exist for both issuers
    const ca = await db
      .select()
      .from(providers)
      .where(eq(providers.category, "ca"));
    expect(ca.length).toBeGreaterThanOrEqual(2);

    // Next call should use DB fast-path: no TLS listener invocation
    const prevCalls = (tlsMock.socketMock.getPeerCertificate as unknown as Mock)
      .mock.calls.length;
    const out2 = await getCertificates("example.com");
    expect(out2.length).toBeGreaterThan(0);
    const nextCalls = (tlsMock.socketMock.getPeerCertificate as unknown as Mock)
      .mock.calls.length;
    expect(nextCalls).toBe(prevCalls);
  });

  it("returns empty on timeout", async () => {
    tlsMock.callListener = false;
    // Ensure cache is clear and use a distinct domain key
    let timeoutCb: (() => void) | null = null;
    let errorHandler: ((err: Error) => void) | undefined;
    tlsMock.socketMock = {
      getPeerCertificate: vi.fn(),
      setTimeout: (_ms: number, cb: () => void) => {
        timeoutCb = cb;
      },
      end: vi.fn(),
      on: vi.fn((event: string, handler: unknown) => {
        if (event === "error" && typeof handler === "function") {
          errorHandler = handler as (err: Error) => void;
        }
        return tlsMock.socketMock;
      }),
      destroy: vi.fn((err?: Error) => {
        errorHandler?.(err ?? new Error("TLS timeout"));
      }),
    } as unknown as tls.TLSSocket;

    const { getCertificates } = await import("./certificates");
    // Kick off without awaiting so the function can attach error handler first
    const pending = getCertificates("timeout.invalid");
    // Yield to event loop to allow synchronous setup inside getCertificates
    await Promise.resolve();
    // Now trigger the timeout callback
    setTimeout(() => timeoutCb?.(), 0);
    const out = await pending;
    expect(out).toEqual([]);
    // no-op
  });
});

describe("tls helper parsing", () => {
  it("parseAltNames extracts DNS/IP values and ignores others", async () => {
    const input = "DNS:example.com, IP Address:1.2.3.4, URI:http://x";
    const { parseAltNames } = await import("./certificates");
    expect(parseAltNames(input)).toEqual(["example.com", "1.2.3.4"]);
  });

  it("parseAltNames handles empty/missing", async () => {
    const { parseAltNames } = await import("./certificates");
    expect(parseAltNames(undefined)).toEqual([]);
    expect(parseAltNames("")).toEqual([]);
  });
  it("toName prefers CN then O then stringifies", () => {
    const cnOnly = {
      CN: "cn.example",
    } as unknown as tls.PeerCertificate["subject"];
    const orgOnly = { O: "Org" } as unknown as tls.PeerCertificate["subject"];
    const other = { X: "Y" } as unknown as tls.PeerCertificate["subject"];
    return import("./certificates").then(({ toName }) => {
      expect(toName(cnOnly)).toBe("cn.example");
      expect(toName(orgOnly)).toBe("Org");
      expect(toName(other)).toContain("X");
    });
  });
});
