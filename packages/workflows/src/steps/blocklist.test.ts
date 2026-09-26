/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { blockedDomains } = await import("@domainstack/db/schema");
const { checkBlocklist } = await import("./blocklist");

beforeAll(async () => {
  await db
    .insert(blockedDomains)
    .values([{ domain: "blocked-site.com" }, { domain: "only.sub-site.com" }]);
});

afterAll(async () => {
  await closePGliteDb();
});

describe("checkBlocklist", () => {
  it("blocks a listed registrable domain", async () => {
    await expect(checkBlocklist("blocked-site.com")).resolves.toBe(true);
  });

  it("blocks every subdomain of a listed domain", async () => {
    await expect(checkBlocklist("www.blocked-site.com")).resolves.toBe(true);
    await expect(checkBlocklist("a.b.blocked-site.com")).resolves.toBe(true);
  });

  it("does not block a listed subdomain's parent or siblings", async () => {
    await expect(checkBlocklist("only.sub-site.com")).resolves.toBe(true);
    await expect(checkBlocklist("sub-site.com")).resolves.toBe(false);
    await expect(checkBlocklist("other.sub-site.com")).resolves.toBe(false);
  });

  it("allows unrelated domains", async () => {
    await expect(checkBlocklist("example.com")).resolves.toBe(false);
  });
});
