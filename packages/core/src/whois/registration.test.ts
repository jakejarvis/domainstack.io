/* @vitest-environment node */
import type { DomainRecord } from "rdapper";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const whoisMock = vi.hoisted(() => ({
  lookupWhois: vi.fn<typeof import("./lookup").lookupWhois>(),
}));

vi.mock("./lookup", () => whoisMock);
vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));
// The real cache read, wrapped so a single test can make it come back empty.
vi.mock("@domainstack/db/queries/registrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@domainstack/db/queries/registrations")>();
  return {
    ...actual,
    getCachedRegistration: vi.fn<typeof actual.getCachedRegistration>(actual.getCachedRegistration),
  };
});

const { getCachedRegistration } = await import("@domainstack/db/queries/registrations");
const { findDomainByName } = await import("@domainstack/db/queries/domains");
const { fetchRegistration } = await import("./index");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
  whoisMock.lookupWhois.mockReset();
});

function mockRecord(record: DomainRecord) {
  whoisMock.lookupWhois.mockResolvedValue({
    success: true,
    recordJson: JSON.stringify(record),
  });
}

describe("fetchRegistration", () => {
  // If the registration response gains a field, add it to these fixtures so the
  // parity assertions cover it.
  describe("fresh vs cached parity", () => {
    it("returns the same data for a registered domain on a cold and a cached lookup", async () => {
      const domain = "parity-registered.com";
      mockRecord({
        domain,
        tld: "com",
        isRegistered: true,
        unicodeName: domain,
        punycodeName: domain,
        registry: "Verisign",
        registrar: { name: "Example Registrar, Inc.", url: "https://registrar.example.net/" },
        reseller: "Example Registrar, Inc.",
        statuses: [
          { status: "clientTransferProhibited", description: "Transfer locked", raw: "raw-1" },
          { status: "clientDeleteProhibited" },
        ],
        creationDate: "2020-01-01T00:00:00Z",
        updatedDate: "2024-06-01T12:30:00Z",
        expirationDate: "2031-01-01T00:00:00Z",
        transferLock: true,
        dnssec: { enabled: true, dsRecords: [{ keyTag: 1, algorithm: 13, digestType: 2 }] },
        nameservers: [{ host: "NS1.Example.NET" }, { host: "ns2.example.net" }],
        contacts: [{ type: "registrant", name: "Jane Doe", countryCode: "US" }],
        privacyEnabled: true,
        whoisServer: "whois.example.net",
        rdapServers: ["https://rdap.example.net/"],
        source: "rdap",
        warnings: ["something odd"],
        rawRdap: {
          ldhName: domain,
          objectClassName: "domain",
          status: ["client transfer prohibited"],
        },
      });

      const fresh = await fetchRegistration(domain);
      expect(fresh.success).toBe(true);
      if (!fresh.success) return;

      expect(typeof fresh.data.domainId).toBe("string");
      expect(fresh.data.domainId).not.toBe("");
      // rdapper reports the reseller as a plain name; it links to the known registrar
      expect(fresh.data.reseller).toBe("Example Registrar, Inc.");

      const cached = await getCachedRegistration(domain);
      expect(fresh.data).toEqual(cached.data);
    });

    it("returns the same data for an unregistered domain on a cold and a cached lookup", async () => {
      const domain = "parity-unregistered.com";
      mockRecord({
        domain,
        tld: "com",
        isRegistered: false,
        unicodeName: domain,
        punycodeName: domain,
        statuses: [{ status: "free" }],
        source: "rdap",
        rawRdap: { errorCode: 404, title: "Not Found" },
      });

      const fresh = await fetchRegistration(domain);
      expect(fresh.success).toBe(true);
      if (!fresh.success) return;

      expect(fresh.data.isRegistered).toBe(false);
      expect(typeof fresh.data.domainId).toBe("string");
      expect(fresh.data.domainId).not.toBe("");

      const cached = await getCachedRegistration(domain);
      expect(fresh.data).toEqual(cached.data);
    });
  });

  describe("unicode name", () => {
    it("derives the unicode name for an IDN when the record carries none", async () => {
      const domain = "xn--bcher-kva.example";
      mockRecord({ domain, tld: "example", isRegistered: true, source: "whois" });

      const fresh = await fetchRegistration(domain);
      expect(fresh.success).toBe(true);

      expect((await findDomainByName(domain))?.unicodeName).toBe("bücher.example");
    });

    it("stores an ASCII domain as its own unicode name when the record carries none", async () => {
      const domain = "plain-ascii.com";
      mockRecord({ domain, tld: "com", isRegistered: true, source: "whois" });

      const fresh = await fetchRegistration(domain);
      expect(fresh.success).toBe(true);

      expect((await findDomainByName(domain))?.unicodeName).toBe(domain);
    });
  });

  it("rejects when the row cannot be read back after persisting", async () => {
    mockRecord({ domain: "example.com", tld: "com", isRegistered: true, source: "rdap" });
    vi.mocked(getCachedRegistration).mockResolvedValueOnce({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });

    await expect(fetchRegistration("example.com")).rejects.toThrow(
      "registration for example.com was persisted but could not be read back",
    );
  });

  it("returns unsupported_tld without throwing", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "unsupported_tld",
      detail: { code: "no_server", attempts: [] },
    });

    await expect(fetchRegistration("example.invalid")).resolves.toEqual({
      success: false,
      error: "unsupported_tld",
    });
  });

  it("throws RemoteDataUnavailableError carrying the attempt trace on timeout", async () => {
    const attempts = [
      {
        phase: "whois" as const,
        server: "whois.nic.sh",
        ok: false,
        durationMs: 5000,
        errorCode: "timeout" as const,
        error: "WHOIS read timeout (whois.nic.sh)",
        stage: "read" as const,
      },
    ];
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "timeout",
      detail: {
        message: "WHOIS read timeout (whois.nic.sh)",
        code: "timeout",
        phase: "whois",
        server: "whois.nic.sh",
        retryAfterMs: 30_000,
        attempts,
      },
    });

    const err = await fetchRegistration("executor.sh").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(RemoteDataUnavailableError);
    expect((err as RemoteDataUnavailableError).message).toBe(
      "WHOIS lookup failed: timeout (WHOIS read timeout (whois.nic.sh))",
    );
    expect((err as RemoteDataUnavailableError).details).toEqual({
      errorCode: "timeout",
      errorPhase: "whois",
      errorServer: "whois.nic.sh",
      retryAfterMs: 30_000,
      attempts,
    });
  });
});
