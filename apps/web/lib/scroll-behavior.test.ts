import { afterEach, describe, expect, it, vi } from "vitest";

import { preferredScrollBehavior } from "@/lib/scroll-behavior";

function stubMatchMedia(reduce: boolean) {
  const matchMedia = vi.fn<(query: string) => { matches: boolean }>((query) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
  }));
  vi.stubGlobal("window", { matchMedia });
  return matchMedia;
}

describe("preferredScrollBehavior", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is smooth when the user has no motion preference", () => {
    const matchMedia = stubMatchMedia(false);
    expect(preferredScrollBehavior()).toBe("smooth");
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("is auto when the user prefers reduced motion", () => {
    stubMatchMedia(true);
    expect(preferredScrollBehavior()).toBe("auto");
  });

  it("is smooth where there is no window", () => {
    expect(preferredScrollBehavior()).toBe("smooth");
  });
});
