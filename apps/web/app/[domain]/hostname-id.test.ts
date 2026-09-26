/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { domains } = await import("@domainstack/db/schema");
const { getOrCreateDomainId } = await import("@domainstack/db/queries/domains");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

// The report page keys hostname-scoped features (screenshots) by this id.
describe("getOrCreateDomainId", () => {
  it("creates a hostname's row once and returns the same id after", async () => {
    const first = await getOrCreateDomainId("api.example.com");
    const second = await getOrCreateDomainId("api.example.com");

    expect(second).toBe(first);
    expect(await db.select().from(domains)).toHaveLength(1);
  });

  it("gives a subdomain, www, and the registrable domain their own rows", async () => {
    const ids = await Promise.all(
      ["example.com", "www.example.com", "api.example.com"].map((name) =>
        getOrCreateDomainId(name),
      ),
    );

    expect(new Set(ids).size).toBe(3);
  });
});
