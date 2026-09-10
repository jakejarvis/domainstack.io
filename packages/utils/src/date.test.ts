import { describe, expect, it } from "vitest";

import { formatDateLong, formatRelativeTime, toDateTimeAttr, toDurationAttr } from "./date";

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

describe("formatDateLong", () => {
  it("spells the month out", () => {
    expect(formatDateLong("2025-10-02T14:30:05.000Z")).toBe("October 2, 2025");
  });

  it("uses the UTC calendar day regardless of the runtime timezone", () => {
    // The reason this exists: date-fns `format` renders in local time, so this
    // instant reads as the previous day anywhere west of UTC. An expiry email
    // must name the same day the dashboard does.
    const justAfterUtcMidnight = "2026-03-01T02:00:00.000Z";
    expect(formatDateLong(justAfterUtcMidnight)).toBe("March 1, 2026");
  });

  it("falls back to the raw string for an unparseable date", () => {
    expect(formatDateLong("not-a-date")).toBe("not-a-date");
  });
});

const now = new Date("2025-06-15T12:00:00.000Z");
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `now` shifted by `ms`, for readable cases below. */
function at(ms: number): Date {
  return new Date(now.getTime() + ms);
}

describe("formatRelativeTime", () => {
  it("adds a suffix in both directions", () => {
    expect(formatRelativeTime(at(5 * DAY), now)).toBe("in 5 days");
    expect(formatRelativeTime(at(-5 * DAY), now)).toBe("5 days ago");
  });

  it("accepts a Date, an ISO string, and epoch milliseconds alike", () => {
    const target = at(5 * DAY);
    expect(formatRelativeTime(target.toISOString(), now)).toBe("in 5 days");
    expect(formatRelativeTime(target.getTime(), now)).toBe("in 5 days");
  });

  it("picks the largest unit that fits", () => {
    expect(formatRelativeTime(at(30 * SECOND), now)).toBe("in 30 seconds");
    expect(formatRelativeTime(at(90 * SECOND), now)).toBe("in 2 minutes");
    expect(formatRelativeTime(at(59 * MINUTE), now)).toBe("in 59 minutes");
    expect(formatRelativeTime(at(90 * MINUTE), now)).toBe("in 2 hours");
    expect(formatRelativeTime(at(23 * HOUR), now)).toBe("in 23 hours");
    expect(formatRelativeTime(at(29 * DAY), now)).toBe("in 29 days");
    expect(formatRelativeTime(at(31 * DAY), now)).toBe("in 1 month");
    expect(formatRelativeTime(at(200 * DAY), now)).toBe("in 7 months");
    expect(formatRelativeTime(at(400 * DAY), now)).toBe("in 1 year");
  });

  it("promotes a full twelve months to a year", () => {
    expect(formatRelativeTime(at(360 * DAY), now)).toBe("in 1 year");
    expect(formatRelativeTime(at(-360 * DAY), now)).toBe("1 year ago");
  });

  it("rounds a half unit away from zero in both directions", () => {
    // Rounding the signed value would give "48 minutes ago" here, because
    // Math.round breaks the -48.5 tie upward.
    expect(formatRelativeTime(at(-48.5 * MINUTE), now)).toBe("49 minutes ago");
    expect(formatRelativeTime(at(48.5 * MINUTE), now)).toBe("in 49 minutes");
  });

  it("treats an identical instant as just past", () => {
    expect(formatRelativeTime(now, now)).toBe("0 seconds ago");
  });

  it("preserves direction when fractional seconds round to zero", () => {
    expect(formatRelativeTime(at(499), now)).toBe("in 0 seconds");
    expect(formatRelativeTime(at(-499), now)).toBe("0 seconds ago");
  });

  it("counts days on the wall clock across a DST change", () => {
    // US clocks go forward on 2025-03-09, so this span is 10 days on the
    // calendar but one hour short of 10 * 24h in absolute time.
    const before = new Date("2025-03-05T12:00:00-05:00");
    const after = new Date("2025-03-15T12:00:00-04:00");
    expect(formatRelativeTime(after, before)).toBe("in 10 days");
    expect(formatRelativeTime(before, after)).toBe("10 days ago");
  });

  it("returns undefined rather than throwing on an invalid date", () => {
    expect(formatRelativeTime("not-a-date", now)).toBeUndefined();
    expect(formatRelativeTime(now, new Date(Number.NaN))).toBeUndefined();
  });
});
