import { describe, expect, it } from "vitest";

import type { PortfolioDomain } from "@/lib/portfolio";
import {
  activeFilterCount,
  applyFilters,
  availableTldsFrom,
  buildChips,
  hasActiveFilters,
  healthBucketFor,
} from "@/lib/portfolio-filters";

const NOW = new Date("2026-06-01T00:00:00.000Z").getTime();

function makeDomain(overrides: Partial<PortfolioDomain> & { id: string }): PortfolioDomain {
  return {
    archivedAt: null,
    ca: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    dns: null,
    domainName: "example.com",
    email: null,
    expirationDate: "2027-06-01T00:00:00.000Z",
    hosting: null,
    muted: false,
    registrar: null,
    verified: true,
    ...overrides,
  };
}

const domains: PortfolioDomain[] = [
  makeDomain({
    domainName: "alpha.com",
    expirationDate: "2027-06-01T00:00:00.000Z",
    id: "alpha",
    verified: true,
  }),
  makeDomain({
    domainName: "beta.io",
    expirationDate: "2026-06-08T00:00:00.000Z",
    id: "beta",
    verified: true,
  }),
  makeDomain({
    domainName: "gamma.dev",
    expirationDate: "2026-05-01T00:00:00.000Z",
    id: "gamma",
    verified: true,
  }),
  makeDomain({
    domainName: "delta.com",
    expirationDate: "2027-01-01T00:00:00.000Z",
    id: "delta",
    muted: true,
    verified: false,
  }),
];

const noFilters = { health: [] as never[], status: "all" as const, tlds: [] as string[] };

describe("portfolio-filters", () => {
  it("applyFilters returns all domains when no filters and no query", () => {
    expect(applyFilters(domains, noFilters, "", NOW)).toHaveLength(4);
  });

  it("applyFilters narrows by case-insensitive query", () => {
    const result = applyFilters(domains, noFilters, "ALPHA", NOW);
    expect(result.map((d) => d.id)).toEqual(["alpha"]);
  });

  it("applyFilters narrows by verified status", () => {
    const result = applyFilters(domains, { ...noFilters, status: "needs-verification" }, "", NOW);
    expect(result.map((d) => d.id)).toEqual(["delta"]);
  });

  it("applyFilters narrows by muted status", () => {
    const result = applyFilters(domains, { ...noFilters, status: "muted" }, "", NOW);
    expect(result.map((d) => d.id)).toEqual(["delta"]);
  });

  it("applyFilters narrows by health bucket", () => {
    const expiring = applyFilters(domains, { ...noFilters, health: ["expiring"] }, "", NOW);
    expect(expiring.map((d) => d.id)).toEqual(["beta"]);

    const expired = applyFilters(domains, { ...noFilters, health: ["expired"] }, "", NOW);
    expect(expired.map((d) => d.id)).toEqual(["gamma"]);

    const healthy = applyFilters(domains, { ...noFilters, health: ["healthy"] }, "", NOW);
    expect(healthy.map((d) => d.id)).toEqual(["alpha"]);
  });

  it("applyFilters narrows by TLD", () => {
    const result = applyFilters(domains, { ...noFilters, tlds: ["com"] }, "", NOW);
    expect(result.map((d) => d.id).sort()).toEqual(["alpha", "delta"]);
  });

  it("applyFilters combines status + health + tld + query", () => {
    const result = applyFilters(
      domains,
      { health: ["healthy"], status: "verified", tlds: ["com"] },
      "alpha",
      NOW,
    );
    expect(result.map((d) => d.id)).toEqual(["alpha"]);
  });

  it("availableTldsFrom returns sorted unique TLDs", () => {
    expect(availableTldsFrom(domains)).toEqual(["com", "dev", "io"]);
  });

  it("healthBucketFor handles unverified and missing dates", () => {
    expect(healthBucketFor(null, true, NOW)).toBeNull();
    expect(healthBucketFor("2026-06-01", false, NOW)).toBeNull();
    expect(healthBucketFor("not-a-date", true, NOW)).toBeNull();
  });

  it("hasActiveFilters reflects state", () => {
    expect(hasActiveFilters(noFilters)).toBe(false);
    expect(hasActiveFilters({ ...noFilters, status: "verified" })).toBe(true);
    expect(hasActiveFilters({ ...noFilters, health: ["healthy"] })).toBe(true);
    expect(hasActiveFilters({ ...noFilters, tlds: ["com"] })).toBe(true);
  });

  it("activeFilterCount sums all dimensions", () => {
    expect(activeFilterCount(noFilters)).toBe(0);
    expect(
      activeFilterCount({
        health: ["healthy", "expired"],
        status: "verified",
        tlds: ["com", "io"],
      }),
    ).toBe(5);
  });

  it("buildChips wires removers per chip", () => {
    const calls: string[] = [];
    const chips = buildChips(
      {
        health: ["expiring"],
        status: "verified",
        tlds: ["com"],
      },
      {
        setStatus: (v) => calls.push(`status:${v}`),
        toggleHealth: (v) => calls.push(`health:${v}`),
        toggleTld: (v) => calls.push(`tld:${v}`),
      },
    );

    expect(chips.map((c) => c.label)).toEqual(["Verified", "Expiring soon", ".com"]);
    chips.forEach((chip) => chip.remove());
    expect(calls).toEqual(["status:all", "health:expiring", "tld:com"]);
  });

  it("buildChips returns empty for default state", () => {
    expect(
      buildChips(noFilters, {
        setStatus: () => {},
        toggleHealth: () => {},
        toggleTld: () => {},
      }),
    ).toEqual([]);
  });
});
