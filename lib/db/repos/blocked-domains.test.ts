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
    const result = await isDomainBlocked("example.com");
    expect(result).toBe(false);
  });

  it("returns true for domain in blocklist", async () => {
    await db.insert(blockedDomains).values({ domain: "blocked.com" });

    const result = await isDomainBlocked("blocked.com");
    expect(result).toBe(true);
  });

  it("is case-sensitive (domains should be stored lowercase)", async () => {
    await db.insert(blockedDomains).values({ domain: "blocked.com" });

    // Exact match works
    expect(await isDomainBlocked("blocked.com")).toBe(true);
    // Different case doesn't match (caller should normalize)
    expect(await isDomainBlocked("BLOCKED.COM")).toBe(false);
  });
});

describe("syncBlockedDomains", () => {
  it("adds new domains to empty table", async () => {
    const result = await syncBlockedDomains([
      "domain1.com",
      "domain2.com",
      "domain3.com",
    ]);

    expect(result.added).toBe(3);
    expect(result.removed).toBe(0);
    expect(result.total).toBe(3);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(3);
  });

  it("deduplicates domains", async () => {
    const result = await syncBlockedDomains([
      "domain.com",
      "domain.com",
      "DOMAIN.COM", // Should normalize to lowercase
    ]);

    expect(result.total).toBe(1);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("domain.com");
  });

  it("preserves existing domains and their addedAt timestamps", async () => {
    // Insert initial domain
    const initialDate = new Date("2024-01-01");
    await db
      .insert(blockedDomains)
      .values({ domain: "existing.com", addedAt: initialDate });

    // Sync with same domain plus a new one
    const result = await syncBlockedDomains(["existing.com", "new.com"]);

    expect(result.added).toBe(1); // Only new.com was added
    expect(result.removed).toBe(0);
    expect(result.total).toBe(2);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(2);

    // Existing domain should keep its original addedAt
    const existingRow = rows.find((r) => r.domain === "existing.com");
    expect(existingRow?.addedAt.getTime()).toBe(initialDate.getTime());
  });

  it("removes domains no longer in source list", async () => {
    // Insert initial domains
    await db
      .insert(blockedDomains)
      .values([{ domain: "keep.com" }, { domain: "remove.com" }]);

    // Sync with only one domain
    const result = await syncBlockedDomains(["keep.com"]);

    expect(result.added).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.total).toBe(1);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("keep.com");
  });

  it("does nothing when given empty array", async () => {
    // Insert initial domains
    await db
      .insert(blockedDomains)
      .values([{ domain: "domain1.com" }, { domain: "domain2.com" }]);

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
    const domains = Array.from({ length: 2500 }, (_, i) => `domain${i}.com`);

    const result = await syncBlockedDomains(domains);

    expect(result.added).toBe(2500);
    expect(result.total).toBe(2500);

    const rows = await db.select().from(blockedDomains);
    expect(rows).toHaveLength(2500);
  });
});
