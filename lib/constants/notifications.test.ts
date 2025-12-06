/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_EXPIRY_THRESHOLDS,
  CERTIFICATE_THRESHOLD_TO_TYPE,
  DOMAIN_EXPIRY_THRESHOLDS,
  DOMAIN_THRESHOLD_TO_TYPE,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_INFO,
} from "./notifications";

describe("NOTIFICATION_CATEGORIES", () => {
  it("contains all expected categories", () => {
    expect(NOTIFICATION_CATEGORIES).toContain("domainExpiry");
    expect(NOTIFICATION_CATEGORIES).toContain("certificateExpiry");
    expect(NOTIFICATION_CATEGORIES).toContain("verificationStatus");
    expect(NOTIFICATION_CATEGORIES).toHaveLength(3);
  });

  it("has info for all categories", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(NOTIFICATION_CATEGORY_INFO[category]).toBeDefined();
      expect(NOTIFICATION_CATEGORY_INFO[category].label).toBeTruthy();
      expect(NOTIFICATION_CATEGORY_INFO[category].description).toBeTruthy();
    }
  });
});

describe("threshold constants", () => {
  it("has matching entries in DOMAIN_THRESHOLD_TO_TYPE", () => {
    for (const threshold of DOMAIN_EXPIRY_THRESHOLDS) {
      expect(DOMAIN_THRESHOLD_TO_TYPE[threshold]).toBeDefined();
      expect(DOMAIN_THRESHOLD_TO_TYPE[threshold]).toMatch(
        /^domain_expiry_\d+d$/,
      );
    }
  });

  it("has matching entries in CERTIFICATE_THRESHOLD_TO_TYPE", () => {
    for (const threshold of CERTIFICATE_EXPIRY_THRESHOLDS) {
      expect(CERTIFICATE_THRESHOLD_TO_TYPE[threshold]).toBeDefined();
      expect(CERTIFICATE_THRESHOLD_TO_TYPE[threshold]).toMatch(
        /^certificate_expiry_\d+d$/,
      );
    }
  });
});
