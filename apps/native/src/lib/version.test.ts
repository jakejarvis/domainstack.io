/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { isVersionBelow } from "./version";

describe("isVersionBelow", () => {
  it("returns false when versions match", () => {
    expect(isVersionBelow("1.4.0", "1.4.0")).toBe(false);
  });

  it("returns false when current is higher", () => {
    expect(isVersionBelow("1.5.0", "1.4.9")).toBe(false);
    expect(isVersionBelow("2.0.0", "1.99.99")).toBe(false);
  });

  it("returns true on lower patch", () => {
    expect(isVersionBelow("1.4.0", "1.4.1")).toBe(true);
  });

  it("returns true on lower minor", () => {
    expect(isVersionBelow("1.3.9", "1.4.0")).toBe(true);
  });

  it("returns true on lower major", () => {
    expect(isVersionBelow("0.9.9", "1.0.0")).toBe(true);
  });

  it("treats missing trailing segments as zero", () => {
    expect(isVersionBelow("1.4", "1.4.0")).toBe(false);
    expect(isVersionBelow("1.4", "1.4.1")).toBe(true);
    expect(isVersionBelow("1.4.0", "1.5")).toBe(true);
  });

  it("strips prerelease tags before comparing", () => {
    expect(isVersionBelow("1.4.0-rc.1", "1.4.0")).toBe(false);
    expect(isVersionBelow("1.4.0-beta", "1.5.0")).toBe(true);
  });

  it("fails open on garbage input", () => {
    expect(isVersionBelow("not-a-version", "1.0.0")).toBe(false);
    expect(isVersionBelow("1.0.0", "garbage")).toBe(false);
    expect(isVersionBelow("", "1.0.0")).toBe(false);
  });
});
