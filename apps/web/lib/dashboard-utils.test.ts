import { describe, expect, it } from "vitest";

import {
  DASHBOARD_TEST_NOW,
  daysFromTestNow,
  EMPTY_PROVIDER,
  makeDashboardDomains,
  makeProvider,
  makeTrackedDomain,
} from "@/components/dashboard/test-fixtures";
import { getDashboardFilterSignature } from "@/hooks/use-dashboard-pagination";
import {
  computeHealthStats,
  DEFAULT_SORT,
  extractAvailableProviders,
  extractAvailableTlds,
  filterDomains,
  getConfirmDialogContent,
  getValidProviderIds,
  type HealthFilter,
  isPagePastEnd,
  parseSortParam,
  serializeSortState,
  sortDomains,
  type StatusFilter,
  validateHealthFilters,
  validateStatusFilters,
} from "@/lib/dashboard-utils";

const domains = makeDashboardDomains();
const availableProviders = extractAvailableProviders(domains);
const validProviderIds = getValidProviderIds(availableProviders);

function names(list: ReturnType<typeof makeDashboardDomains>) {
  return list.map((d) => d.domainName);
}

describe("parseSortParam / serializeSortState", () => {
  it("parses columnId.direction into TanStack sorting state", () => {
    expect(parseSortParam("expirationDate.desc")).toEqual([{ id: "expirationDate", desc: true }]);
    expect(parseSortParam("domainName.asc")).toEqual([{ id: "domainName", desc: false }]);
  });

  it("falls back to domainName asc for invalid values", () => {
    expect(parseSortParam("")).toEqual([{ id: "domainName", desc: false }]);
    expect(parseSortParam("nope")).toEqual([{ id: "domainName", desc: false }]);
    expect(parseSortParam("domainName.sideways")).toEqual([{ id: "domainName", desc: false }]);
  });

  it("round-trips through serializeSortState", () => {
    const parsed = parseSortParam("createdAt.desc");
    expect(serializeSortState(parsed)).toBe("createdAt.desc");
  });

  it("serializes empty sorting to DEFAULT_SORT", () => {
    expect(serializeSortState([])).toBe(DEFAULT_SORT);
  });
});

describe("sortDomains", () => {
  it("sorts by name A-Z and Z-A without pushing unverified last", () => {
    expect(names(sortDomains(domains, "domainName.asc"))).toEqual([
      "alpha.com",
      "beta.io",
      "gamma.com",
      "pending.dev",
    ]);
    expect(names(sortDomains(domains, "domainName.desc"))).toEqual([
      "pending.dev",
      "gamma.com",
      "beta.io",
      "alpha.com",
    ]);
  });

  it("sorts by expiry and keeps unverified last", () => {
    expect(names(sortDomains(domains, "expirationDate.asc"))).toEqual([
      "gamma.com",
      "beta.io",
      "alpha.com",
      "pending.dev",
    ]);
  });

  it("sorts by recently added", () => {
    const older = makeTrackedDomain({
      id: "old",
      domainName: "old.com",
      createdAt: daysFromTestNow(-10),
    });
    const newer = makeTrackedDomain({
      id: "new",
      domainName: "new.com",
      createdAt: daysFromTestNow(-1),
    });
    expect(names(sortDomains([older, newer], "createdAt.desc"))).toEqual(["new.com", "old.com"]);
  });
});

describe("filterDomains", () => {
  const emptyCriteria = {
    search: "",
    domainId: null,
    status: [] as StatusFilter[],
    health: [] as HealthFilter[],
    tlds: [] as string[],
    providers: [] as string[],
  };

  it("filters by search substring case-insensitively", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, search: "BETA" },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["beta.io"]);
  });

  it("ANDs search with TLD and health", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, search: "a", tlds: ["com"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["alpha.com", "gamma.com"]);
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, tlds: ["com"], health: ["expired"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["gamma.com"]);
  });

  it("filters by verification status", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, status: ["pending"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["pending.dev"]);
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, status: ["verified"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["alpha.com", "beta.io", "gamma.com"]);
  });

  it("filters by health", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, health: ["healthy"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["alpha.com"]);
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, health: ["expiring"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["beta.io"]);
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, health: ["expired"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["gamma.com"]);
  });

  it("filters by TLD", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, tlds: ["io"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["beta.io"]);
  });

  it("filters by provider across categories and excludes unverified", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, providers: ["cloudflare"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["alpha.com", "beta.io"]);
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, providers: ["vercel"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["gamma.com"]);
  });

  it("pins a single domain by id", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, domainId: "domain-gamma" },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["gamma.com"]);
  });

  it("ignores unknown provider ids for verified domains and still excludes unverified", () => {
    expect(
      names(
        filterDomains(
          domains,
          { ...emptyCriteria, providers: ["not-a-provider"] },
          validProviderIds,
          DASHBOARD_TEST_NOW,
        ),
      ),
    ).toEqual(["alpha.com", "beta.io", "gamma.com"]);
  });
});

describe("extractAvailableTlds / extractAvailableProviders", () => {
  it("extracts sorted unique TLDs including unverified", () => {
    expect(extractAvailableTlds(domains)).toEqual(["com", "dev", "io"]);
  });

  it("skips unverified and archived domains when collecting providers", () => {
    const archived = makeTrackedDomain({
      id: "archived",
      domainName: "archived.net",
      tld: "net",
      archivedAt: DASHBOARD_TEST_NOW,
      registrar: makeProvider("godaddy", "GoDaddy", "godaddy.com"),
    });
    const providers = extractAvailableProviders([...domains, archived]);
    expect(providers.registrar.map((p) => p.id)).toEqual(["cloudflare", "namecheap"]);
    expect(providers.dns.map((p) => p.id)).toEqual(["cloudflare"]);
    expect(providers.hosting.map((p) => p.id)).toEqual(["vercel"]);
  });
});

describe("computeHealthStats", () => {
  it("counts expiring-soon and pending verification, not expired", () => {
    expect(computeHealthStats(domains, DASHBOARD_TEST_NOW)).toEqual({
      expiringSoon: 1,
      pendingVerification: 1,
    });
  });
});

describe("validateStatusFilters / validateHealthFilters", () => {
  it("drops unknown URL values", () => {
    expect(validateStatusFilters(["verified", "nope", "pending"])).toEqual(["verified", "pending"]);
    expect(validateHealthFilters(["healthy", "boom", "expired"])).toEqual(["healthy", "expired"]);
  });
});

describe("isPagePastEnd", () => {
  it("is false for a valid page and true when the page is empty", () => {
    expect(isPagePastEnd(12, 1, 10)).toBe(false);
    expect(isPagePastEnd(2, 1, 10)).toBe(true);
    expect(isPagePastEnd(0, 0, 10)).toBe(false);
    // Loading fallback (0 results) looks like page 2 is past the end — callers must wait for data.
    expect(isPagePastEnd(0, 1, 10)).toBe(true);
  });
});

describe("makeTrackedDomain", () => {
  it("clones providers and dates so mutations stay isolated", () => {
    const [first] = makeDashboardDomains();
    first.registrar.id = "mutated";
    first.registrar.name = "Mutated";
    first.createdAt.setUTCFullYear(1999);
    first.expirationDate?.setUTCFullYear(1999);

    const [next] = makeDashboardDomains();
    expect(next.registrar.id).toBe("cloudflare");
    expect(next.registrar.name).toBe("Cloudflare");
    expect(next.createdAt.getUTCFullYear()).toBe(2026);
    expect(next.expirationDate?.getUTCFullYear()).toBe(2027);
    expect(DASHBOARD_TEST_NOW.getUTCFullYear()).toBe(2026);
  });
});

describe("getDashboardFilterSignature", () => {
  it("changes when a filter value changes", () => {
    const base = {
      search: "",
      status: [] as string[],
      health: [] as string[],
      tlds: [] as string[],
      providers: [] as string[],
      domainId: null,
    };
    expect(getDashboardFilterSignature({ ...base, search: "s" })).not.toBe(
      getDashboardFilterSignature(base),
    );
  });
});

describe("getConfirmDialogContent", () => {
  it("returns copy and variants for single and bulk actions", () => {
    expect(
      getConfirmDialogContent({ type: "remove", domainId: "1", domainName: "alpha.com" }),
    ).toEqual({
      title: "Remove domain?",
      description: "Are you sure you want to stop tracking alpha.com?",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    expect(
      getConfirmDialogContent({ type: "archive", domainId: "1", domainName: "alpha.com" }),
    ).toMatchObject({
      title: "Archive domain?",
      confirmLabel: "Archive",
      variant: "default",
    });
    expect(
      getConfirmDialogContent({ type: "bulk-archive", domainIds: ["1", "2"], count: 2 }),
    ).toMatchObject({
      title: "Archive 2 domains?",
      confirmLabel: "Archive All",
    });
    expect(getConfirmDialogContent({ type: "bulk-delete", domainIds: ["1"], count: 1 })).toEqual({
      title: "Delete 1 domain?",
      description: "Are you sure you want to stop tracking 1 domain?",
      confirmLabel: "Delete All",
      variant: "destructive",
    });
  });
});

describe("empty provider fixture", () => {
  it("has null identity fields", () => {
    expect(EMPTY_PROVIDER).toEqual({ id: null, name: null, domain: null });
  });
});
