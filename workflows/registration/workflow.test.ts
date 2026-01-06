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

// Hoist mocks for rdapper
const rdapperMock = vi.hoisted(() => ({
  lookup: vi.fn(),
  getDomainTld: vi.fn((domain: string) => domain.split(".").pop() ?? ""),
}));

vi.mock("rdapper", () => rdapperMock);

// Mock RDAP bootstrap data
vi.mock("@/lib/rdap-bootstrap", () => ({
  getRdapBootstrapData: vi.fn().mockResolvedValue({
    version: "1.0",
    publication: "2024-01-01T00:00:00Z",
    services: [],
  }),
}));

// Mock provider catalog
vi.mock("@/lib/providers/catalog", () => ({
  getProviders: vi.fn().mockResolvedValue([]),
}));

// Mock provider detection
vi.mock("@/lib/providers/detection", () => ({
  detectRegistrar: vi.fn().mockReturnValue(null),
}));

describe("registrationWorkflow step functions", () => {
  // Setup PGlite for database tests
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@/lib/db/pglite");
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  describe("checkCache step", () => {
    it("returns cached registration when present and not expired", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertRegistration } = await import(
        "@/lib/db/repos/registrations"
      );

      // Create a cached registration
      const domain = await upsertDomain({
        name: "cached.com",
        tld: "com",
        unicodeName: "cached.com",
      });

      await upsertRegistration({
        domainId: domain.id,
        isRegistered: true,
        registry: "Verisign",
        statuses: [],
        contacts: [],
        whoisServer: null,
        rdapServers: [],
        source: "rdap",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // expires tomorrow
        transferLock: null,
        creationDate: null,
        updatedDate: null,
        expirationDate: null,
        deletionDate: null,
        registrarProviderId: null,
        resellerProviderId: null,
        nameservers: [],
      });

      // Import and test the workflow
      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "cached.com" });

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      if (result.success) {
        expect(result.data.domain).toBe("cached.com");
        expect(result.data.isRegistered).toBe(true);
      }
    });

    it("returns not found when cache is expired", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertRegistration } = await import(
        "@/lib/db/repos/registrations"
      );

      // Create an expired cached registration
      const domain = await upsertDomain({
        name: "expired.com",
        tld: "com",
        unicodeName: "expired.com",
      });

      await upsertRegistration({
        domainId: domain.id,
        isRegistered: true,
        registry: "Verisign",
        statuses: [],
        contacts: [],
        whoisServer: null,
        rdapServers: [],
        source: "rdap",
        fetchedAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() - 1000), // expired
        transferLock: null,
        creationDate: null,
        updatedDate: null,
        expirationDate: null,
        deletionDate: null,
        registrarProviderId: null,
        resellerProviderId: null,
        nameservers: [],
      });

      // Mock rdapper to return a result
      rdapperMock.lookup.mockResolvedValue({
        ok: true,
        error: null,
        record: {
          domain: "expired.com",
          tld: "com",
          isRegistered: true,
          source: "rdap",
        },
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "expired.com" });

      expect(result.success).toBe(true);
      expect(result.cached).toBe(false); // Should have fetched fresh data
      expect(rdapperMock.lookup).toHaveBeenCalled();
    });
  });

  describe("lookupRdap step", () => {
    it("returns success with record when RDAP lookup succeeds", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: true,
        error: null,
        record: {
          domain: "example.com",
          tld: "com",
          isRegistered: true,
          source: "rdap",
          registrar: { name: "GoDaddy" },
        },
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "example.com" });

      expect(result.success).toBe(true);
      expect(result.cached).toBe(false);
      if (result.success) {
        expect(result.data.isRegistered).toBe(true);
      }
    });

    it("handles unsupported TLD gracefully", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: false,
        error: "No WHOIS server discovered for TLD",
        record: null,
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "example.ls" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("unsupported_tld");
        expect(result.data?.unavailableReason).toBe("unsupported_tld");
      }
    });

    it("handles timeout gracefully", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: false,
        error: "WHOIS socket timeout",
        record: null,
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "slow.com" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("timeout");
        expect(result.data?.unavailableReason).toBe("timeout");
      }
    });

    it("handles lookup failure with unknown error", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: false,
        error: "Connection refused",
        record: null,
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "error.com" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("lookup_failed");
      }
    });
  });

  describe("normalizeAndBuildResponse step", () => {
    it("builds correct response for registered domain", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: true,
        error: null,
        record: {
          domain: "registered.com",
          tld: "com",
          isRegistered: true,
          source: "rdap",
          registrar: { name: "Namecheap", url: "https://namecheap.com" },
          creationDate: "2020-01-01T00:00:00Z",
          expirationDate: "2025-01-01T00:00:00Z",
          nameservers: [{ host: "ns1.example.com" }],
        },
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "registered.com" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("registered");
        expect(result.data.isRegistered).toBe(true);
        expect(result.data.creationDate).toBe("2020-01-01T00:00:00Z");
        expect(result.data.expirationDate).toBe("2025-01-01T00:00:00Z");
      }
    });

    it("builds correct response for unregistered domain", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: true,
        error: null,
        record: {
          domain: "available.com",
          tld: "com",
          isRegistered: false,
          source: "rdap",
        },
      });

      const { registrationWorkflow } = await import("./workflow");
      const result = await registrationWorkflow({ domain: "available.com" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("unregistered");
        expect(result.data.isRegistered).toBe(false);
      }
    });
  });

  describe("persistRegistration step", () => {
    it("persists registered domain to database", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: true,
        error: null,
        record: {
          domain: "persist.com",
          tld: "com",
          isRegistered: true,
          source: "rdap",
          registrar: { name: "GoDaddy" },
        },
      });

      const { registrationWorkflow } = await import("./workflow");
      await registrationWorkflow({ domain: "persist.com" });

      // Verify domain was persisted
      const { db } = await import("@/lib/db/client");
      const { domains, registrations } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const domainRows = await db
        .select()
        .from(domains)
        .where(eq(domains.name, "persist.com"));

      expect(domainRows).toHaveLength(1);

      const regRows = await db
        .select()
        .from(registrations)
        .where(eq(registrations.domainId, domainRows[0].id));

      expect(regRows).toHaveLength(1);
      expect(regRows[0].isRegistered).toBe(true);
    });

    it("does not persist unregistered domains", async () => {
      rdapperMock.lookup.mockResolvedValue({
        ok: true,
        error: null,
        record: {
          domain: "unregistered.com",
          tld: "com",
          isRegistered: false,
          source: "rdap",
        },
      });

      const { registrationWorkflow } = await import("./workflow");
      await registrationWorkflow({ domain: "unregistered.com" });

      // Verify domain was NOT persisted
      const { db } = await import("@/lib/db/client");
      const { domains } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const domainRows = await db
        .select()
        .from(domains)
        .where(eq(domains.name, "unregistered.com"));

      expect(domainRows).toHaveLength(0);
    });
  });
});
