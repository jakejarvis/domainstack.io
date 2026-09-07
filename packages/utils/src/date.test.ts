import { describe, expect, it } from "vitest";

import { toDateTimeAttr, toDurationAttr } from "./date";

describe("toDateTimeAttr", () => {
  it("returns a UTC ISO 8601 string for Date, ISO string, and epoch ms", () => {
    expect(toDateTimeAttr(new Date("2025-10-02T14:30:05.000Z"))).toBe("2025-10-02T14:30:05.000Z");
    expect(toDateTimeAttr("2025-10-02T14:30:05.000Z")).toBe("2025-10-02T14:30:05.000Z");
    expect(toDateTimeAttr(Date.parse("2025-10-02T14:30:05.000Z"))).toBe("2025-10-02T14:30:05.000Z");
  });

  it("returns undefined for invalid values", () => {
    expect(toDateTimeAttr("Unknown")).toBeUndefined();
    expect(toDateTimeAttr(Number.NaN)).toBeUndefined();
    expect(toDateTimeAttr(new Date(Number.NaN))).toBeUndefined();
  });
});

describe("toDurationAttr", () => {
  it("returns an ISO 8601 duration in seconds", () => {
    expect(toDurationAttr(3600)).toBe("PT3600S");
    expect(toDurationAttr(0)).toBe("PT0S");
  });

  it("returns undefined for invalid values", () => {
    expect(toDurationAttr(-1)).toBeUndefined();
    expect(toDurationAttr(Number.NaN)).toBeUndefined();
    expect(toDurationAttr(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
