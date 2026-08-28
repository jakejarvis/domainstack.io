/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { ProviderInfo, TrackedDomainWithDetails } from "@domainstack/types";

import { buildDomainExpiryEvents } from "./events";

const BASE_URL = "https://domainstack.io";

function provider(overrides: Partial<ProviderInfo> = {}): ProviderInfo {
  return { id: null, name: null, domain: null, ...overrides };
}

function domain(overrides: Partial<TrackedDomainWithDetails> = {}): TrackedDomainWithDetails {
  return {
    id: "td_1",
    userId: "user_1",
    domainId: "d_1",
    domainName: "example.com",
    tld: "com",
    verified: true,
    verificationMethod: null,
    verificationToken: "",
    verificationStatus: "verified",
    verificationFailedAt: null,
    lastVerifiedAt: null,
    muted: false,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    verifiedAt: null,
    archivedAt: null,
    expirationDate: new Date("2030-06-15T12:34:56.000Z"),
    registrationDate: null,
    registrar: provider(),
    dns: provider(),
    hosting: provider(),
    email: provider(),
    ca: provider(),
    ...overrides,
  };
}

describe("buildDomainExpiryEvents", () => {
  it("excludes unverified domains and domains without an expiration date", () => {
    const events = buildDomainExpiryEvents(
      [
        domain({ id: "td_keep", domainName: "keep.com" }),
        domain({ id: "td_unverified", domainName: "unverified.com", verified: false }),
        domain({ id: "td_noexpiry", domainName: "noexpiry.com", expirationDate: null }),
      ],
      { baseUrl: BASE_URL },
    );

    expect(events.map((e) => e.domainName)).toEqual(["keep.com"]);
    expect(events[0]?.trackedDomainId).toBe("td_keep");
    expect(events[0]?.uid).toBe("td_keep@domainstack.io");
  });

  it("formats the summary, url, and base description fields", () => {
    const [event] = buildDomainExpiryEvents([domain()], { baseUrl: BASE_URL });

    expect(event?.summary).toBe("🌐 example.com expires");
    expect(event?.url).toBe("https://domainstack.io/dashboard?domainId=td_1");
    expect(event?.expirationDate.toISOString()).toBe("2030-06-15T12:34:56.000Z");
    expect(event?.description).toBe(
      [
        "Domain: example.com",
        "",
        "Exact time: 2030-06-15T12:34:56.000Z",
        "",
        "View more details: https://domainstack.io/dashboard?domainId=td_1",
      ].join("\n"),
    );
  });

  it("includes registrar and SSL certificate lines when present", () => {
    const [event] = buildDomainExpiryEvents(
      [
        domain({
          registrar: provider({ name: "Example Registrar" }),
          ca: provider({ certificateExpiryDate: new Date("2029-01-02T03:04:05.000Z") }),
        }),
      ],
      { baseUrl: BASE_URL },
    );

    expect(event?.description).toBe(
      [
        "Domain: example.com",
        "Registrar: Example Registrar",
        "",
        "Exact time: 2030-06-15T12:34:56.000Z",
        "SSL certificate expires: 2029-01-02T03:04:05.000Z",
        "",
        "View more details: https://domainstack.io/dashboard?domainId=td_1",
      ].join("\n"),
    );
  });

  it("sorts deterministically by uid regardless of input order", () => {
    const events = buildDomainExpiryEvents(
      [
        domain({ id: "td_c", domainName: "c.com" }),
        domain({ id: "td_a", domainName: "a.com" }),
        domain({ id: "td_b", domainName: "b.com" }),
      ],
      { baseUrl: BASE_URL },
    );

    expect(events.map((e) => e.uid)).toEqual([
      "td_a@domainstack.io",
      "td_b@domainstack.io",
      "td_c@domainstack.io",
    ]);
  });

  it("returns an empty array when no domains qualify", () => {
    expect(buildDomainExpiryEvents([], { baseUrl: BASE_URL })).toEqual([]);
    expect(buildDomainExpiryEvents([domain({ verified: false })], { baseUrl: BASE_URL })).toEqual(
      [],
    );
  });
});
