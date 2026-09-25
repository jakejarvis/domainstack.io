import { describe, expect, it } from "vitest";

import { calculateDaysElapsed, calculateDaysRemaining } from "./expiry";

describe("calculateDaysRemaining", () => {
  const now = new Date("2024-06-15T12:00:00Z");

  it("calculates days for future date", () => {
    const future = new Date("2024-06-25T12:00:00Z");
    expect(calculateDaysRemaining(future, now)).toBe(10);
  });

  it("calculates days for past date (negative)", () => {
    const past = new Date("2024-06-10T12:00:00Z");
    expect(calculateDaysRemaining(past, now)).toBe(-5);
  });

  it("returns 0 for same day", () => {
    expect(calculateDaysRemaining(now, now)).toBe(0);
  });

  it("accepts string dates", () => {
    expect(calculateDaysRemaining("2024-06-25T12:00:00Z", now)).toBe(10);
  });

  it("handles partial days correctly (floors)", () => {
    const almostTomorrow = new Date("2024-06-16T11:00:00Z");
    expect(calculateDaysRemaining(almostTomorrow, now)).toBe(0);

    const justOverTomorrow = new Date("2024-06-16T13:00:00Z");
    expect(calculateDaysRemaining(justOverTomorrow, now)).toBe(1);
  });
});

describe("calculateDaysElapsed", () => {
  const now = new Date("2024-06-15T12:00:00Z");

  it("counts whole days since a past date", () => {
    expect(calculateDaysElapsed(new Date("2024-06-10T12:00:00Z"), now)).toBe(5);
  });

  it("ignores a partial day rather than rounding it up", () => {
    expect(calculateDaysElapsed(new Date("2024-06-10T00:00:00Z"), now)).toBe(5);
  });

  it("returns 0 for the same instant", () => {
    expect(calculateDaysElapsed(now, now)).toBe(0);
  });

  it("is negative for a future date", () => {
    expect(calculateDaysElapsed(new Date("2024-06-20T12:00:00Z"), now)).toBe(-5);
  });

  it("mirrors calculateDaysRemaining with the arguments swapped", () => {
    const other = new Date("2024-07-01T00:00:00Z");
    expect(calculateDaysElapsed(other, now)).toBe(calculateDaysRemaining(now, other));
  });

  it("accepts an ISO string", () => {
    expect(calculateDaysElapsed("2024-06-10T12:00:00Z", now)).toBe(5);
  });
});
