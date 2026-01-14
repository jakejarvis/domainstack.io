/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB client before importing anything else
vi.mock("@/lib/db/client", async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  return { db };
});

import { db } from "@/lib/db/client";
import { blockedDomains } from "@/lib/db/schema";
import { isDomainBlocked, syncBlockedDomains } from "./blocked-domains";

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  // Clear blocked_domains table before each test
  await db.delete(blockedDomains);
});

describe("isDomainBlocked", () => {
  it("returns false for domain not in blocklist", async () => {
    const result = await isDomainBlocked("notblocked.invalid");
    expect(result).toBe(false);
  });

  it("returns true for domain in blocklist", async () => {
    await db.insert(blockedDomains).values({ domain: "blocked.invalid" });

    const result = await isDomainBlocked("blocked.invalid");
    expect(result).toBe(true);
  });

  it("is case-sensitive (domains should be stored lowercase)", async () => {
    await db.insert(blockedDomains).values({ domain: "blocked.invalid" });

    // Exact match works
    expect(await isDomainBlocked("blocked.invalid")).toBe(true);
    // Different case doesn't match (caller should normalize)
    expect(await isDomainBlocked("BLOCKED.INVALID")).toBe(false);
  });
});

describe("syncBlockedDomains", () => {
  it("adds new domains to empty table", async () => {
    const result = await syncBlockedDomains([
      "domain1.invalid",
      "domain2.invalid",
      "domain3.invalid",
    ]);

    expect(result.added).toBe(3);
    expect(result.removed).toBe(0);
    expect(result.total).toBe(3);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(3);
  });

  it("deduplicates domains", async () => {
    const result = await syncBlockedDomains([
      "domain.invalid",
      "domain.invalid",
      "DOMAIN.INVALID", // Should normalize to lowercase
    ]);

    expect(result.total).toBe(1);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("domain.invalid");
  });

  it("preserves existing domains and their addedAt timestamps", async () => {
    // Insert initial domain
    const initialDate = new Date("2024-01-01");
    await db
      .insert(blockedDomains)
      .values({ domain: "existing.invalid", addedAt: initialDate });

    // Sync with same domain plus a new one
    const result = await syncBlockedDomains([
      "existing.invalid",
      "new.invalid",
    ]);

    expect(result.added).toBe(1); // Only new.invalid was added
    expect(result.removed).toBe(0);
    expect(result.total).toBe(2);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(2);

    // Existing domain should keep its original addedAt
    const existingRow = rows.find((r) => r.domain === "existing.invalid");
    expect(existingRow?.addedAt.getTime()).toBe(initialDate.getTime());
  });

  it("removes domains no longer in source list", async () => {
    // Insert initial domains
    await db
      .insert(blockedDomains)
      .values([{ domain: "keep.invalid" }, { domain: "remove.invalid" }]);

    // Sync with only one domain
    const result = await syncBlockedDomains(["keep.invalid"]);

    expect(result.added).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.total).toBe(1);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("keep.invalid");
  });

  it("does nothing when given empty array", async () => {
    // Insert initial domains
    await db
      .insert(blockedDomains)
      .values([{ domain: "domain1.invalid" }, { domain: "domain2.invalid" }]);

    const result = await syncBlockedDomains([]);

    // Should not clear existing blocklist (could indicate upstream fetch failure)
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.total).toBe(0);

    // Existing domains should still be there
    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(2);
  });

  it("handles large batch of domains", async () => {
    // Create 2500 domains to test batching (BATCH_SIZE is 1000)
    const domains = Array.from(
      { length: 2500 },
      (_, i) => `domain${i}.invalid`,
    );

    const result = await syncBlockedDomains(domains);

    expect(result.added).toBe(2500);
    expect(result.total).toBe(2500);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(2500);
  });
});
