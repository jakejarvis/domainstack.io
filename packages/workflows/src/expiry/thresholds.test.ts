/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { CERTIFICATE_EXPIRY_THRESHOLDS, DOMAIN_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import { calculateDaysRemaining } from "@domainstack/utils/expiry";

import {
  certificateThresholdsForLifetime,
  getThresholdNotificationType,
  inDaysPhrase,
} from "./thresholds";

describe("getThresholdNotificationType", () => {
  it("returns smallest matching threshold for domain expiry", () => {
    expect(getThresholdNotificationType(5, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_7d",
    );

    expect(getThresholdNotificationType(1, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_1d",
    );

    expect(getThresholdNotificationType(10, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_14d",
    );
  });

  it("returns smallest matching threshold for certificate expiry", () => {
    expect(
      getThresholdNotificationType(5, CERTIFICATE_EXPIRY_THRESHOLDS, "certificate_expiry"),
    ).toBe("certificate_expiry_7d");

    expect(
      getThresholdNotificationType(10, CERTIFICATE_EXPIRY_THRESHOLDS, "certificate_expiry"),
    ).toBe("certificate_expiry_14d");

    expect(
      getThresholdNotificationType(2, CERTIFICATE_EXPIRY_THRESHOLDS, "certificate_expiry"),
    ).toBe("certificate_expiry_3d");
  });

  it("returns null when days exceeds all thresholds", () => {
    expect(getThresholdNotificationType(45, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBeNull();

    expect(
      getThresholdNotificationType(100, CERTIFICATE_EXPIRY_THRESHOLDS, "certificate_expiry"),
    ).toBeNull();
  });

  it("handles exact threshold boundaries", () => {
    expect(getThresholdNotificationType(30, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_30d",
    );

    expect(getThresholdNotificationType(7, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_7d",
    );
  });

  it("handles zero and negative days", () => {
    expect(getThresholdNotificationType(0, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_1d",
    );

    expect(getThresholdNotificationType(-5, DOMAIN_EXPIRY_THRESHOLDS, "domain_expiry")).toBe(
      "domain_expiry_1d",
    );
  });

  it("handles unsorted threshold arrays", () => {
    const unsorted = [7, 30, 1, 14] as const;
    expect(getThresholdNotificationType(5, unsorted, "domain_expiry")).toBe("domain_expiry_7d");
  });

  it("ignores thresholds that are not valid for the prefix", () => {
    expect(getThresholdNotificationType(10, [90, 30, 14, 7], "certificate_expiry")).toBe(
      "certificate_expiry_14d",
    );
    expect(getThresholdNotificationType(25, [90, 30, 14, 7], "certificate_expiry")).toBeNull();
    expect(getThresholdNotificationType(5, [90, 3, 7], "domain_expiry")).toBe("domain_expiry_7d");
  });
});

describe("getThresholdNotificationType with an unusable date", () => {
  it("returns null instead of the most urgent threshold for NaN", () => {
    expect(getThresholdNotificationType(Number.NaN, [30, 14, 7, 1], "domain_expiry")).toBeNull();
    expect(
      getThresholdNotificationType(Number.POSITIVE_INFINITY, [30, 14, 7, 1], "domain_expiry"),
    ).toBeNull();
  });

  it("returns null for an unparseable expiration date end to end", () => {
    const days = calculateDaysRemaining("not-a-date");
    expect(getThresholdNotificationType(days, [30, 14, 7, 1], "domain_expiry")).toBeNull();
  });
});

describe("certificateThresholdsForLifetime", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");
  const lifetime = (days: number) => new Date(from.getTime() + days * 86_400_000);

  it("keeps every threshold for 90-day and 45-day certificates", () => {
    expect(certificateThresholdsForLifetime(from, lifetime(90))).toEqual([14, 7, 3, 1]);
    expect(certificateThresholdsForLifetime(from, lifetime(45))).toEqual([14, 7, 3, 1]);
  });

  it("drops thresholds at or above a third of the lifetime", () => {
    expect(certificateThresholdsForLifetime(from, lifetime(6.7))).toEqual([1]);
    expect(certificateThresholdsForLifetime(from, lifetime(2))).toEqual([]);
  });

  it("returns the original list for a zero or negative lifetime", () => {
    expect(certificateThresholdsForLifetime(from, from)).toEqual([14, 7, 3, 1]);
    expect(certificateThresholdsForLifetime(from, lifetime(-5))).toEqual([14, 7, 3, 1]);
  });
});

describe("inDaysPhrase", () => {
  it("phrases floored day counts without tomorrow or 0 days", () => {
    expect(inDaysPhrase(0)).toBe("within 24 hours");
    expect(inDaysPhrase(1)).toBe("in 1 day");
    expect(inDaysPhrase(5)).toBe("in 5 days");
  });
});
