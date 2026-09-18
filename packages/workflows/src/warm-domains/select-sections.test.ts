import { describe, expect, it } from "vitest";

import { REFRESH_AHEAD_MS, selectSectionsToRefresh, WARM_SECTIONS } from "./select-sections";
import type { SectionCacheState, WarmSection } from "./select-sections";

const now = Date.UTC(2026, 0, 1);
const at = (ms: number) => new Date(now + ms);
const fresh: SectionCacheState = { data: {}, expiresAt: at(24 * 3600_000) };

function cacheOf(
  overrides: Partial<Record<WarmSection, SectionCacheState>>,
): Record<WarmSection, SectionCacheState> {
  return {
    registration: fresh,
    hosting: fresh,
    technologies: fresh,
    certificates: fresh,
    headers: fresh,
    seo: fresh,
    ...overrides,
  };
}

describe("selectSectionsToRefresh", () => {
  it("does not warm dns", () => {
    expect(WARM_SECTIONS).not.toContain("dns");
  });

  it("returns nothing when all five sections are fresh", () => {
    expect(selectSectionsToRefresh(cacheOf({}), now)).toEqual([]);
  });

  it("refreshes a section expiring just inside the refresh-ahead window", () => {
    const cache = cacheOf({ seo: { data: {}, expiresAt: at(REFRESH_AHEAD_MS - 1) } });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["seo"]);
  });

  it("refreshes a section expiring exactly at the refresh-ahead boundary", () => {
    const cache = cacheOf({ seo: { data: {}, expiresAt: at(REFRESH_AHEAD_MS) } });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["seo"]);
  });

  it("leaves a section expiring just outside the refresh-ahead window alone", () => {
    const cache = cacheOf({ seo: { data: {}, expiresAt: at(REFRESH_AHEAD_MS + 1) } });
    expect(selectSectionsToRefresh(cache, now)).toEqual([]);
  });

  it("refreshes a section with no cached data", () => {
    const cache = cacheOf({ registration: { data: null, expiresAt: null } });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["registration"]);
  });

  it("refreshes a section with cached data but no expiry", () => {
    const cache = cacheOf({ certificates: { data: {}, expiresAt: null } });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["certificates"]);
  });

  it("drops headers from the result when hosting is also due", () => {
    const due = { data: {}, expiresAt: at(0) };
    const cache = cacheOf({ hosting: due, headers: due });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["hosting"]);
  });

  it("keeps headers when hosting is fresh", () => {
    const cache = cacheOf({ headers: { data: {}, expiresAt: at(0) } });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["headers"]);

    const due = { data: {}, expiresAt: at(0) };
    const allDue = cacheOf({
      registration: due,
      hosting: due,
      technologies: due,
      certificates: due,
      headers: due,
      seo: due,
    });
    expect(selectSectionsToRefresh(allDue, now)).toEqual([
      "registration",
      "hosting",
      "technologies",
      "certificates",
      "seo",
    ]);
  });

  it("refreshes technologies when its cache is missing", () => {
    const cache = cacheOf({ technologies: { data: null, expiresAt: null } });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["technologies"]);
  });

  it("does not drop technologies when seo is also due", () => {
    const due = { data: {}, expiresAt: at(0) };
    const cache = cacheOf({ technologies: due, seo: due });
    expect(selectSectionsToRefresh(cache, now)).toEqual(["technologies", "seo"]);
  });
});
