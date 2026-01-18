/* @vitest-environment node */
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock the DB client with PGlite before importing anything else
vi.mock("@/lib/db/client", async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  return { db };
});

import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  domains,
  userSubscriptions,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import { handleDowngrade } from "./downgrade";

let testUserId = "";
const testDomainIds: string[] = [];

beforeAll(async () => {
  // Create a test user
  const insertedUser = await db
    .insert(users)
    .values({
      id: "downgrade-test-user",
      name: "Test User",
      email: "downgrade-test@example.test",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;

  // Create a subscription for the user (start as Pro)
  await db.insert(userSubscriptions).values({
    userId: testUserId,
    tier: "pro",
  });

  // Create multiple test domains
  for (let i = 0; i < 10; i++) {
    const inserted = await db
      .insert(domains)
      .values({
        name: `downgrade-test-${i}.com`,
        tld: "test",
        unicodeName: `downgrade-test-${i}.com`,
      })
      .returning();
    testDomainIds.push(inserted[0].id);
  }
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  // Clear tracked domains before each test
  await db.delete(userTrackedDomains);
  // Reset subscription tier to Pro
  await db.update(userSubscriptions).set({ tier: "pro" });
});

describe("handleDowngrade", () => {
  it("updates user tier to free", async () => {
    // Add 3 tracked domains (under limit)
    for (let i = 0; i < 3; i++) {
      await db.insert(userTrackedDomains).values({
        userId: testUserId,
        domainId: testDomainIds[i],
        verificationToken: `token-${i}`,
        verified: true,
      });
    }

    await handleDowngrade(testUserId);

    // Check tier was updated to free
    const [subscription] = await db.select().from(userSubscriptions).limit(1);
    expect(subscription.tier).toBe("free");
  });

  it("does not archive domains when under limit", async () => {
    // Add 3 tracked domains (under limit of 5)
    for (let i = 0; i < 3; i++) {
      await db.insert(userTrackedDomains).values({
        userId: testUserId,
        domainId: testDomainIds[i],
        verificationToken: `token-${i}`,
        verified: true,
      });
    }

    const result = await handleDowngrade(testUserId);

    expect(result).toBe(0);

    // Verify no domains were archived
    const trackedDomains = await db.select().from(userTrackedDomains);
    expect(trackedDomains.every((d) => d.archivedAt === null)).toBe(true);
  });

  it("does not archive domains when at limit", async () => {
    // Add exactly 5 tracked domains (at limit)
    for (let i = 0; i < 5; i++) {
      await db.insert(userTrackedDomains).values({
        userId: testUserId,
        domainId: testDomainIds[i],
        verificationToken: `token-${i}`,
        verified: true,
      });
    }

    const result = await handleDowngrade(testUserId);

    expect(result).toBe(0);

    // Verify no domains were archived
    const trackedDomains = await db.select().from(userTrackedDomains);
    expect(trackedDomains.every((d) => d.archivedAt === null)).toBe(true);
  });

  it("archives excess domains when over limit", async () => {
    // Add 8 tracked domains (3 over limit)
    for (let i = 0; i < 8; i++) {
      await db.insert(userTrackedDomains).values({
        userId: testUserId,
        domainId: testDomainIds[i],
        verificationToken: `token-${i}`,
        verified: true,
      });
    }

    const result = await handleDowngrade(testUserId);

    expect(result).toBe(3);

    // Verify 3 domains were archived
    const trackedDomains = await db.select().from(userTrackedDomains);
    const archived = trackedDomains.filter((d) => d.archivedAt !== null);
    const active = trackedDomains.filter((d) => d.archivedAt === null);

    expect(archived.length).toBe(3);
    expect(active.length).toBe(5);
  });

  it("archives oldest domains first", async () => {
    // Add 7 tracked domains with staggered creation times (2 over free limit of 5)
    const baseDate = new Date("2024-01-01T00:00:00Z");
    for (let i = 0; i < 7; i++) {
      await db.insert(userTrackedDomains).values({
        userId: testUserId,
        domainId: testDomainIds[i],
        verificationToken: `token-${i}`,
        verified: true,
        createdAt: new Date(baseDate.getTime() + i * 86_400_000), // Each day later
      });
    }

    const result = await handleDowngrade(testUserId);

    expect(result).toBe(2);

    // The 2 oldest domains (indices 0 and 1) should be archived
    const trackedDomains = await db
      .select()
      .from(userTrackedDomains)
      .orderBy(asc(userTrackedDomains.createdAt));

    expect(trackedDomains[0].archivedAt).not.toBeNull(); // oldest
    expect(trackedDomains[1].archivedAt).not.toBeNull(); // second oldest
    expect(trackedDomains[2].archivedAt).toBeNull(); // third
    expect(trackedDomains[3].archivedAt).toBeNull(); // fourth
    expect(trackedDomains[4].archivedAt).toBeNull(); // fifth
    expect(trackedDomains[5].archivedAt).toBeNull(); // sixth
    expect(trackedDomains[6].archivedAt).toBeNull(); // newest
  });

  it("creates subscription record if not found during downgrade", async () => {
    // Create a new user without a subscription
    const [newUser] = await db
      .insert(users)
      .values({
        id: "new-user-no-sub",
        name: "New User",
        email: "newuser@example.test",
        emailVerified: true,
      })
      .returning();

    // Add a tracked domain for this user
    await db.insert(userTrackedDomains).values({
      userId: newUser.id,
      domainId: testDomainIds[0],
      verificationToken: "token-new",
      verified: true,
    });

    const result = await handleDowngrade(newUser.id);

    expect(result).toBe(0);

    // Verify subscription was created
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, newUser.id));
    expect(subscription).toBeDefined();
    expect(subscription.tier).toBe("free");
  });
});
