/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import(
  "@domainstack/db/testing"
);
const { db } = await makePGliteDb();

describe("persistHeadersStep", () => {
  beforeEach(async () => {
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
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
    const { findDomainByName } = await import("@domainstack/db/queries");
    const domain = await findDomainByName("persist.test");
    expect(domain).toBeTruthy();

    // Use the PGlite db instance (already set as the singleton)
    const { httpHeaders } = await import("@domainstack/db/schema");
    const { eq } = await import("@domainstack/db/drizzle");

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
