import { describe, expect, it } from "vitest";
import {
  calculateDaysRemaining,
  getThresholdNotificationType,
} from "./threshold";

describe("getThresholdNotificationType", () => {
  const domainThresholds = [30, 14, 7, 1];
  const certThresholds = [90, 30, 14, 7];

  it("returns smallest matching threshold for domain expiry", () => {
    expect(
      getThresholdNotificationType(5, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_7d");

    expect(
      getThresholdNotificationType(1, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_1d");

    expect(
      getThresholdNotificationType(10, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_14d");
  });

  it("returns smallest matching threshold for certificate expiry", () => {
    expect(
      getThresholdNotificationType(25, certThresholds, "certificate_expiry"),
    ).toBe("certificate_expiry_30d");

    expect(
      getThresholdNotificationType(60, certThresholds, "certificate_expiry"),
    ).toBe("certificate_expiry_90d");
  });

  it("returns null when days exceeds all thresholds", () => {
    expect(
      getThresholdNotificationType(45, domainThresholds, "domain_expiry"),
    ).toBeNull();

    expect(
      getThresholdNotificationType(100, certThresholds, "certificate_expiry"),
    ).toBeNull();
  });

  it("handles exact threshold boundaries", () => {
    expect(
      getThresholdNotificationType(30, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_30d");

    expect(
      getThresholdNotificationType(7, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_7d");
  });

  it("handles zero and negative days", () => {
    expect(
      getThresholdNotificationType(0, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_1d");

    expect(
      getThresholdNotificationType(-5, domainThresholds, "domain_expiry"),
    ).toBe("domain_expiry_1d");
  });

  it("handles unsorted threshold arrays", () => {
    const unsorted = [7, 30, 1, 14] as const;
    expect(getThresholdNotificationType(5, unsorted, "domain_expiry")).toBe(
      "domain_expiry_7d",
    );
  });
});

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
