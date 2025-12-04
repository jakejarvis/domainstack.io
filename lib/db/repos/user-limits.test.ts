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

// Mock Edge Config before importing anything else
vi.mock("@/lib/edge-config", () => ({
  getMaxDomainsForTier: vi.fn(async (tier: "free" | "pro") => {
    return tier === "free" ? 5 : 50;
  }),
  getTierLimits: vi.fn(async () => ({ free: 5, pro: 50 })),
}));

// Mock the DB client
vi.mock("@/lib/db/client", async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  return { db };
});

import { db } from "@/lib/db/client";
import { userLimits, users } from "@/lib/db/schema";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import {
  canUserAddDomain,
  getOrCreateUserLimits,
  setMaxDomainsOverride,
  updateUserTier,
} from "./user-limits";

let testUserId: string;

beforeAll(async () => {
  // Create a test user
  const insertedUser = await db
    .insert(users)
    .values({
      id: "test-limits-user-123",
      name: "Test Limits User",
      email: "limits@example.com",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  // Clear user limits before each test
  await db.delete(userLimits);
  vi.clearAllMocks();
});

describe("getOrCreateUserLimits", () => {
  it("creates new limits for user with free tier", async () => {
    const result = await getOrCreateUserLimits(testUserId);

    expect(result.userId).toBe(testUserId);
    expect(result.tier).toBe("free");
    expect(result.maxDomains).toBe(5);
    expect(result.hasOverride).toBe(false);
    expect(getMaxDomainsForTier).toHaveBeenCalledWith("free");
  });

  it("returns existing limits without creating new ones", async () => {
    // Create limits first
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "pro",
      maxDomainsOverride: null,
    });

    const result = await getOrCreateUserLimits(testUserId);

    expect(result.userId).toBe(testUserId);
    expect(result.tier).toBe("pro");
    expect(result.maxDomains).toBe(50); // Pro tier from Edge Config
    expect(result.hasOverride).toBe(false);
  });

  it("returns override value when set", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: 100, // Special override
    });

    const result = await getOrCreateUserLimits(testUserId);

    expect(result.maxDomains).toBe(100);
    expect(result.hasOverride).toBe(true);
    // Should NOT call Edge Config when override is set
    expect(getMaxDomainsForTier).not.toHaveBeenCalled();
  });
});

describe("updateUserTier", () => {
  it("updates tier and clears any override", async () => {
    // Create user with override
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: 100,
    });

    const result = await updateUserTier(testUserId, "pro");

    expect(result.tier).toBe("pro");
    expect(result.maxDomainsOverride).toBeNull();
  });

  it("updates timestamp on tier change", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: null,
    });

    const before = new Date();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await updateUserTier(testUserId, "pro");

    expect(result.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("setMaxDomainsOverride", () => {
  it("sets custom domain limit", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: null,
    });

    const result = await setMaxDomainsOverride(testUserId, 25);

    expect(result.maxDomainsOverride).toBe(25);
  });

  it("clears override when set to null", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: 100,
    });

    const result = await setMaxDomainsOverride(testUserId, null);

    expect(result.maxDomainsOverride).toBeNull();
  });
});

describe("canUserAddDomain", () => {
  it("returns true when under limit", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: null,
    });

    const result = await canUserAddDomain(testUserId, 3);
    expect(result).toBe(true);
  });

  it("returns false when at limit", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: null,
    });

    const result = await canUserAddDomain(testUserId, 5);
    expect(result).toBe(false);
  });

  it("returns false when over limit", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: null,
    });

    const result = await canUserAddDomain(testUserId, 10);
    expect(result).toBe(false);
  });

  it("respects custom override", async () => {
    await db.insert(userLimits).values({
      userId: testUserId,
      tier: "free",
      maxDomainsOverride: 100,
    });

    // Would be over free tier (5) but under override (100)
    const result = await canUserAddDomain(testUserId, 50);
    expect(result).toBe(true);
  });

  it("creates limits if they don't exist", async () => {
    // Don't create limits beforehand
    const result = await canUserAddDomain(testUserId, 3);
    expect(result).toBe(true);

    // Verify limits were created
    const limits = await getOrCreateUserLimits(testUserId);
    expect(limits.tier).toBe("free");
  });
});
