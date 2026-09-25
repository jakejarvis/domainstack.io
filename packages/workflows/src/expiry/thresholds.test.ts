/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { CERTIFICATE_EXPIRY_THRESHOLDS, DOMAIN_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import { calculateDaysRemaining } from "@domainstack/utils/expiry";

import { getThresholdNotificationType } from "./thresholds";

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
