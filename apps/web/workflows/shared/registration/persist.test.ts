/* @vitest-environment node */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock schedule revalidation
vi.mock("@/lib/revalidation", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

describe("persistRegistrationStep", () => {
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

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  it("persists registered domain to database", async () => {
    // rawResponse is the raw RDAP JSON object (not prettified)
    const rawRdapResponse = {
      objectClassName: "domain",
      handle: "persist.com",
      ldhName: "persist.com",
    };

    const response = {
      domain: "persist.com",
      tld: "com",
      isRegistered: true,
      status: "registered" as const,
      source: "rdap" as const,
      registrarProvider: { id: null, name: "GoDaddy", domain: null },
      rawResponse: rawRdapResponse,
    };

    const { persistRegistrationStep } = await import("./persist");
    const domainId = await persistRegistrationStep("persist.com", response);

    expect(domainId).toBeTruthy();

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
});
