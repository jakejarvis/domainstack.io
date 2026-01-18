/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { ttlForCertificates, ttlForDnsRecord, ttlForRegistration } from "./ttl";

describe("TTL policy", () => {
  it("registration: 24h when far from expiry", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const exp = new Date("2024-02-01T00:00:00.000Z");
    const d = ttlForRegistration(now, exp);
    expect(d.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("registration: 24h when no expiry date", () => {
    // Note: Unregistered domains are never stored in Postgres.
    // This function only runs for registered domains in practice.
    const now = new Date("2024-01-01T00:00:00.000Z");
    const d = ttlForRegistration(now, null);
    expect(d.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("registration: 1h when expiry within 7d", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const exp = new Date("2024-01-05T00:00:00.000Z");
    const d = ttlForRegistration(now, exp);
    expect(d.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });

  it("registration: 1h when expiry exactly at 7d threshold", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    // Exactly 7 days from now (threshold boundary)
    const exp = new Date("2024-01-08T00:00:00.000Z");
    const d = ttlForRegistration(now, exp);
    // Should use near-expiry TTL (1h) because msUntil <= threshold
    expect(d.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });

  it("registration: 24h when expiry just beyond 7d threshold", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    // 7 days + 1 second from now (just beyond threshold)
    const exp = new Date("2024-01-08T00:00:01.000Z");
    const d = ttlForRegistration(now, exp);
    // Should use standard TTL (24h) because msUntil > threshold
    expect(d.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("dns: default 1h when ttl missing", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const d = ttlForDnsRecord(now, undefined);
    expect(d.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });

  it("dns: cap at 24h", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const d = ttlForDnsRecord(now, 3 * 24 * 60 * 60);
    expect(d.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("certs: before valid_to and within 24h window", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const validTo = new Date("2024-01-04T00:00:00.000Z");
    const d = ttlForCertificates(now, validTo);
    // min(now+24h, valid_to-48h) => valid_to-48h here (Jan 2)
    // but clamped to at least TTL_CERTIFICATES_MIN (1h)
    expect(d.toISOString()).toBe(
      new Date("2024-01-01T01:00:00.000Z").toISOString(),
    );
  });

  it("certs: clamps to minimum when valid_to is inside the 48h buffer", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const validTo = new Date("2024-01-01T02:00:00.000Z");
    const d = ttlForCertificates(now, validTo);
    expect(d.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });
});
