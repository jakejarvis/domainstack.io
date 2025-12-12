/* @vitest-environment node */
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

const hoisted = vi.hoisted(() => ({
  lookup: vi.fn(async (_domain: string) => ({
    ok: true,
    error: null,
    record: {
      isRegistered: true,
      source: "rdap",
      registrar: { name: "GoDaddy" },
    },
  })),
}));

vi.mock("rdapper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("rdapper")>();
  return {
    ...actual,
    lookup: hoisted.lookup,
  };
});

vi.mock("@/lib/rdap-bootstrap", () => ({
  getRdapBootstrapData: vi.fn().mockResolvedValue({
    version: "1.0",
    publication: "2024-01-01T00:00:00Z",
    services: [],
  }),
}));

describe("getRegistration", () => {
  // Setup DB mock once for all tests (expensive operations)
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  // Reset only data between tests (lightweight operation)
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

  it("returns cached record when present (DB fast-path, rdapper not called)", async () => {
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const { upsertRegistration } = await import("@/lib/db/repos/registrations");
    const { lookup } = await import("rdapper");
    const spy = lookup as unknown as import("vitest").Mock;
    spy.mockClear();

    const d = await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });
    await upsertRegistration({
      domainId: d.id,
      isRegistered: true,
      registry: "verisign",
      statuses: [],
      contacts: [],
      whoisServer: null,
      rdapServers: [],
      source: "rdap",
      fetchedAt: new Date("2024-01-01T00:00:00.000Z"),
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      transferLock: null,
      creationDate: null,
      updatedDate: null,
      expirationDate: null,
      deletionDate: null,
      registrarProviderId: null,
      resellerProviderId: null,
      nameservers: [],
    });

    const { getRegistration } = await import("./registration");
    const rec = await getRegistration("example.com");
    expect(rec.isRegistered).toBe(true);
    expect(rec.status).toBe("registered");
    expect(rec.unavailableReason).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("loads via rdapper, creates registrar provider when missing, and caches", async () => {
    const { getRegistration } = await import("./registration");
    const rec = await getRegistration("example.com");
    expect(rec.isRegistered).toBe(true);
    expect(rec.status).toBe("registered");
    expect(rec.registrarProvider?.name).toBe("GoDaddy");

    // Verify provider row exists and is linked
    const { db } = await import("@/lib/db/client");
    const { domains, providers, registrations } = await import(
      "@/lib/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const d = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, "example.com"))
      .limit(1);
    const row = (
      await db
        .select({ registrarProviderId: registrations.registrarProviderId })
        .from(registrations)
        .where(eq(registrations.domainId, d[0].id))
        .limit(1)
    )[0];
    expect(row.registrarProviderId).toBeTruthy();
    const prov = (
      await db
        .select({ name: providers.name })
        .from(providers)
        .where(eq(providers.id, row.registrarProviderId as string))
        .limit(1)
    )[0];
    expect(prov?.name).toBe("GoDaddy");
  });

  it("does not persist unregistered domains in Postgres", async () => {
    const { lookup } = await import("rdapper");
    (lookup as unknown as import("vitest").Mock).mockResolvedValueOnce({
      ok: true,
      error: null,
      record: { isRegistered: false, source: "rdap" },
    });

    const { getRegistration } = await import("./registration");
    const rec = await getRegistration("unregistered.test");
    expect(rec.isRegistered).toBe(false);
    expect(rec.status).toBe("unregistered");

    // Verify NOT stored in Postgres
    const { db } = await import("@/lib/db/client");
    const { domains } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const d = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, "unregistered.test"))
      .limit(1);
    expect(d.length).toBe(0);
  });

  it("persists registered domains in Postgres", async () => {
    const { lookup } = await import("rdapper");
    (lookup as unknown as import("vitest").Mock).mockResolvedValueOnce({
      ok: true,
      error: null,
      record: {
        isRegistered: true,
        source: "rdap",
        registrar: { name: "Test Registrar" },
      },
    });

    const { getRegistration } = await import("./registration");
    const rec = await getRegistration("registered.test");
    expect(rec.isRegistered).toBe(true);
    expect(rec.status).toBe("registered");

    // Verify stored in Postgres
    const { db } = await import("@/lib/db/client");
    const { domains, registrations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const d = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, "registered.test"))
      .limit(1);
    expect(d.length).toBe(1);

    const reg = await db
      .select()
      .from(registrations)
      .where(eq(registrations.domainId, d[0].id))
      .limit(1);
    expect(reg.length).toBe(1);
    expect(reg[0].isRegistered).toBe(true);
  });

  it("handles TLDs without WHOIS/RDAP gracefully (no server discovered)", async () => {
    const { lookup } = await import("rdapper");

    // Simulate rdapper error for TLD without WHOIS server
    (lookup as unknown as import("vitest").Mock).mockResolvedValueOnce({
      ok: false,
      error:
        "No WHOIS server discovered for TLD 'ls'. This registry may not publish public WHOIS over port 43.",
      record: null,
    });

    const { getRegistration } = await import("./registration");
    const rec = await getRegistration("whois.ls");

    // Should return response with status: "unknown" and unavailableReason
    expect(rec.domain).toBe("whois.ls");
    expect(rec.tld).toBe("ls");
    expect(rec.isRegistered).toBe(false); // Backward compatibility
    expect(rec.status).toBe("unknown"); // Explicit status
    expect(rec.unavailableReason).toBe("unsupported_tld");
    expect(rec.source).toBeNull();
    expect(rec.registrarProvider.name).toBeNull();
    expect(rec.registrarProvider.domain).toBeNull();

    // Note: Logger calls are tested by integration - the service calls logger.info()
    // which is mocked in vitest.setup.ts to not actually log anything
  });

  it("handles TLDs with unresponsive WHOIS servers gracefully (timeout)", async () => {
    const { lookup } = await import("rdapper");

    // Simulate rdapper timeout error (WHOIS server exists but doesn't respond)
    (lookup as unknown as import("vitest").Mock).mockResolvedValueOnce({
      ok: false,
      error: "WHOIS socket timeout",
      record: null,
    });

    const { getRegistration } = await import("./registration");
    const rec = await getRegistration("timeout.ls");

    // Should return response with status: "unknown" and unavailableReason: "timeout"
    expect(rec.domain).toBe("timeout.ls");
    expect(rec.tld).toBe("ls");
    expect(rec.isRegistered).toBe(false); // Backward compatibility
    expect(rec.status).toBe("unknown"); // Explicit status
    expect(rec.unavailableReason).toBe("timeout");
    expect(rec.source).toBeNull();

    // Note: Logger calls are tested by integration - the service calls logger.info()
    // which is mocked in vitest.setup.ts to not actually log anything
  });

  it("logs actual registration errors as errors (timeout, network failure)", async () => {
    const { lookup } = await import("rdapper");

    // Simulate a real error (timeout, network failure, etc.)
    (lookup as unknown as import("vitest").Mock).mockResolvedValueOnce({
      ok: false,
      error: "Connection timeout after 5000ms",
      record: null,
    });

    const { getRegistration } = await import("./registration");

    // Should throw error
    await expect(getRegistration("timeout.test")).rejects.toThrow(
      "Registration lookup failed for timeout.test: Connection timeout after 5000ms",
    );

    // Note: Logger calls are tested by integration - the service calls logger.error()
    // which is mocked in vitest.setup.ts to not actually log anything
  });
});
