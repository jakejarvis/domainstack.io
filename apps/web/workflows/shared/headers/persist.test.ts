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

describe("persistHeadersStep", () => {
  // Setup PGlite for database tests
  beforeAll(async () => {
    const { makePGliteDb } = await import("@domainstack/db/testing");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@domainstack/db/testing");
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@domainstack/db/testing");
    await closePGliteDb();
  });

  it("persists headers to database", async () => {
    // Mock schedule revalidation for this test
    vi.doMock("@/lib/revalidation", () => ({
      scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
    }));

    const { persistHeadersStep } = await import("./persist");
    await persistHeadersStep("persist.test", {
      headers: [
        { name: "server", value: "nginx" },
        { name: "content-type", value: "text/html" },
      ],
      status: 200,
      statusMessage: "OK",
    });

    // Verify persistence - domain should have been created
    const { domainsRepo } = await import("@/lib/db/repos");
    const domain = await domainsRepo.findDomainByName("persist.test");
    expect(domain).toBeTruthy();

    const { db } = await import("@/lib/db/client");
    const { httpHeaders } = await import("@domainstack/db/schema");
    const { eq } = await import("drizzle-orm");

    const stored = await db
      .select()
      .from(httpHeaders)
      .where(eq(httpHeaders.domainId, domain?.id))
      .limit(1);

    expect(stored.length).toBe(1);
    expect(stored[0].status).toBe(200);
    expect(stored[0].headers).toEqual([
      { name: "server", value: "nginx" },
      { name: "content-type", value: "text/html" },
    ]);
  });
});
