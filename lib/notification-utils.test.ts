/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  generateIdempotencyKey,
  getCertificateExpiryNotificationType,
  getDomainExpiryNotificationType,
} from "./notification-utils";

describe("generateIdempotencyKey", () => {
  it("generates key in expected format", () => {
    const key = generateIdempotencyKey(
      "tracked-domain-123",
      "domain_expiry_30d",
    );
    expect(key).toBe("tracked-domain-123:domain_expiry_30d");
  });

  it("generates unique keys for different domains", () => {
    const key1 = generateIdempotencyKey("domain-1", "domain_expiry_30d");
    const key2 = generateIdempotencyKey("domain-2", "domain_expiry_30d");
    expect(key1).not.toBe(key2);
  });

  it("generates unique keys for different notification types", () => {
    const key1 = generateIdempotencyKey("domain-1", "domain_expiry_30d");
    const key2 = generateIdempotencyKey("domain-1", "domain_expiry_14d");
    expect(key1).not.toBe(key2);
  });

  it("generates consistent keys for same inputs", () => {
    const key1 = generateIdempotencyKey("domain-1", "domain_expiry_30d");
    const key2 = generateIdempotencyKey("domain-1", "domain_expiry_30d");
    expect(key1).toBe(key2);
  });

  it("works with all notification types", () => {
    const types = [
      "domain_expiry_30d",
      "domain_expiry_14d",
      "domain_expiry_7d",
      "domain_expiry_1d",
      "certificate_expiry_14d",
      "certificate_expiry_7d",
      "certificate_expiry_3d",
      "certificate_expiry_1d",
      "verification_failing",
      "verification_revoked",
    ] as const;

    for (const type of types) {
      const key = generateIdempotencyKey("test-domain", type);
      expect(key).toBe(`test-domain:${type}`);
    }
  });
});

describe("getDomainExpiryNotificationType", () => {
  it("returns null when days remaining exceeds all thresholds", () => {
    expect(getDomainExpiryNotificationType(31)).toBeNull();
    expect(getDomainExpiryNotificationType(100)).toBeNull();
    expect(getDomainExpiryNotificationType(365)).toBeNull();
  });

  it("returns 30d notification for 30 days or less (but more than 14)", () => {
    expect(getDomainExpiryNotificationType(30)).toBe("domain_expiry_30d");
    expect(getDomainExpiryNotificationType(29)).toBe("domain_expiry_30d");
    expect(getDomainExpiryNotificationType(15)).toBe("domain_expiry_30d");
  });

  it("returns 14d notification for 14 days or less (but more than 7)", () => {
    expect(getDomainExpiryNotificationType(14)).toBe("domain_expiry_14d");
    expect(getDomainExpiryNotificationType(13)).toBe("domain_expiry_14d");
    expect(getDomainExpiryNotificationType(8)).toBe("domain_expiry_14d");
  });

  it("returns 7d notification for 7 days or less (but more than 1)", () => {
    expect(getDomainExpiryNotificationType(7)).toBe("domain_expiry_7d");
    expect(getDomainExpiryNotificationType(6)).toBe("domain_expiry_7d");
    expect(getDomainExpiryNotificationType(2)).toBe("domain_expiry_7d");
  });

  it("returns 1d notification for 1 day or less", () => {
    expect(getDomainExpiryNotificationType(1)).toBe("domain_expiry_1d");
    expect(getDomainExpiryNotificationType(0)).toBe("domain_expiry_1d");
    expect(getDomainExpiryNotificationType(-1)).toBe("domain_expiry_1d");
  });

  it("returns the MOST URGENT notification type (smallest threshold)", () => {
    // Critical: daysRemaining=14 should return 14d, not 30d
    expect(getDomainExpiryNotificationType(14)).toBe("domain_expiry_14d");
    // daysRemaining=7 should return 7d, not 14d or 30d
    expect(getDomainExpiryNotificationType(7)).toBe("domain_expiry_7d");
    // daysRemaining=1 should return 1d, not 7d/14d/30d
    expect(getDomainExpiryNotificationType(1)).toBe("domain_expiry_1d");
  });
});

describe("getCertificateExpiryNotificationType", () => {
  it("returns null when days remaining exceeds all thresholds", () => {
    expect(getCertificateExpiryNotificationType(15)).toBeNull();
    expect(getCertificateExpiryNotificationType(30)).toBeNull();
    expect(getCertificateExpiryNotificationType(100)).toBeNull();
  });

  it("returns 14d notification for 14 days or less (but more than 7)", () => {
    expect(getCertificateExpiryNotificationType(14)).toBe(
      "certificate_expiry_14d",
    );
    expect(getCertificateExpiryNotificationType(13)).toBe(
      "certificate_expiry_14d",
    );
    expect(getCertificateExpiryNotificationType(8)).toBe(
      "certificate_expiry_14d",
    );
  });

  it("returns 7d notification for 7 days or less (but more than 3)", () => {
    expect(getCertificateExpiryNotificationType(7)).toBe(
      "certificate_expiry_7d",
    );
    expect(getCertificateExpiryNotificationType(6)).toBe(
      "certificate_expiry_7d",
    );
    expect(getCertificateExpiryNotificationType(4)).toBe(
      "certificate_expiry_7d",
    );
  });

  it("returns 3d notification for 3 days or less (but more than 1)", () => {
    expect(getCertificateExpiryNotificationType(3)).toBe(
      "certificate_expiry_3d",
    );
    expect(getCertificateExpiryNotificationType(2)).toBe(
      "certificate_expiry_3d",
    );
  });

  it("returns 1d notification for 1 day or less", () => {
    expect(getCertificateExpiryNotificationType(1)).toBe(
      "certificate_expiry_1d",
    );
    expect(getCertificateExpiryNotificationType(0)).toBe(
      "certificate_expiry_1d",
    );
    expect(getCertificateExpiryNotificationType(-1)).toBe(
      "certificate_expiry_1d",
    );
  });

  it("returns the MOST URGENT notification type (smallest threshold)", () => {
    // Critical: daysRemaining=7 should return 7d, not 14d
    expect(getCertificateExpiryNotificationType(7)).toBe(
      "certificate_expiry_7d",
    );
    // daysRemaining=3 should return 3d, not 7d/14d
    expect(getCertificateExpiryNotificationType(3)).toBe(
      "certificate_expiry_3d",
    );
    // daysRemaining=1 should return 1d, not 3d/7d/14d
    expect(getCertificateExpiryNotificationType(1)).toBe(
      "certificate_expiry_1d",
    );
  });
});
