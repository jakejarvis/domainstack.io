/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { affectedCounts, applySubscriptionDelta } from "./portfolio-mutations";

function domain(id: string, archived: boolean) {
  return { id, archivedAt: archived ? new Date("2030-01-01T00:00:00.000Z") : null };
}

describe("affectedCounts", () => {
  it("splits active vs archived for the requested ids", () => {
    const variant = [domain("a", false), domain("b", true), domain("c", false)];
    expect(affectedCounts([["k", variant]], ["a", "b", "c"])).toEqual({ active: 2, archived: 1 });
  });

  it("ignores ids that aren't requested", () => {
    const variant = [domain("a", false), domain("b", false)];
    expect(affectedCounts([["k", variant]], ["a"])).toEqual({ active: 1, archived: 0 });
  });

  it("dedupes a domain present in multiple cached variants", () => {
    const includeArchivedFalse = [domain("a", false)];
    const includeArchivedTrue = [domain("a", false), domain("z", true)];
    expect(
      affectedCounts(
        [
          ["false", includeArchivedFalse],
          ["true", includeArchivedTrue],
        ],
        ["a", "z"],
      ),
    ).toEqual({ active: 1, archived: 1 });
  });

  it("skips empty/undefined cached entries", () => {
    expect(affectedCounts([["k", undefined]], ["a"])).toEqual({ active: 0, archived: 0 });
    expect(affectedCounts([], ["a"])).toEqual({ active: 0, archived: 0 });
  });
});

describe("applySubscriptionDelta", () => {
  const base = {
    plan: "pro" as const,
    planQuota: 10,
    endsAt: null,
    activeCount: 5,
    archivedCount: 2,
    canAddMore: true,
  };

  it("applies positive and negative deltas and recomputes canAddMore", () => {
    expect(applySubscriptionDelta(base, -1, 1)).toMatchObject({
      activeCount: 4,
      archivedCount: 3,
      canAddMore: true,
    });
  });

  it("recomputes canAddMore=false when active reaches the quota", () => {
    expect(applySubscriptionDelta(base, 5, 0)).toMatchObject({
      activeCount: 10,
      canAddMore: false,
    });
  });

  it("clamps both counts at zero (never negative)", () => {
    expect(applySubscriptionDelta(base, -99, -99)).toMatchObject({
      activeCount: 0,
      archivedCount: 0,
      canAddMore: true,
    });
  });

  it("preserves unrelated fields and does not mutate the input", () => {
    const next = applySubscriptionDelta(base, -1, 0);
    expect(next.plan).toBe("pro");
    expect(next.endsAt).toBeNull();
    expect(base.activeCount).toBe(5);
  });
});
