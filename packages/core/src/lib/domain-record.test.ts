/* @vitest-environment node */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const { db } = await import("@domainstack/db/client");
const { eq } = await import("@domainstack/db/drizzle");
const { ensureDomainRecord, upsertDomain } = await import("@domainstack/db/queries/domains");
const { domains } = await import("@domainstack/db/schema");

async function readDomain(name: string) {
  const [row] = await db.select().from(domains).where(eq(domains.name, name));
  return row;
}

// Advance the clock so an unchanged `updatedAt` proves no write happened, not equal timestamps.
function advanceClock() {
  vi.setSystemTime(new Date(Date.now() + 60_000));
}

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ensureDomainRecord", () => {
  it("returns the same row on repeat calls without rewriting it", async () => {
    const first = await ensureDomainRecord("example.com");
    advanceClock();
    const second = await ensureDomainRecord("example.com");

    expect(second.id).toBe(first.id);
    expect((await readDomain("example.com"))?.updatedAt).toEqual(first.updatedAt);
  });

  it("does not overwrite a stored Unicode name with the punycode form", async () => {
    await upsertDomain({
      name: "xn--bcher-kva.example",
      tld: "example",
      unicodeName: "bücher.example",
    });

    await ensureDomainRecord("xn--bcher-kva.example");

    expect((await readDomain("xn--bcher-kva.example"))?.unicodeName).toBe("bücher.example");
  });
});

describe("upsertDomain", () => {
  const params = { name: "example.com", tld: "com", unicodeName: "example.com" };

  it("leaves the row untouched when nothing changed and still returns it", async () => {
    const first = await upsertDomain(params);
    advanceClock();
    const second = await upsertDomain(params);

    expect(second.id).toBe(first.id);
    expect(second.updatedAt).toEqual(first.updatedAt);
    expect((await readDomain("example.com"))?.updatedAt).toEqual(first.updatedAt);
  });

  it("updates unicodeName and updatedAt when a value changes", async () => {
    const first = await upsertDomain(params);
    advanceClock();
    const second = await upsertDomain({ ...params, unicodeName: "exämple.com" });

    expect(second.id).toBe(first.id);
    expect(second.unicodeName).toBe("exämple.com");
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
  });
});
