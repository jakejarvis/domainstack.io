import { EXPIRING_SOON_DAYS } from "@domainstack/constants";
import type { ProviderInfo, TrackedDomainWithDetails } from "@domainstack/types";

/** Stable clock for health/expiry fixtures. Keep in sync with `vi.setSystemTime` in tests. */
export const DASHBOARD_TEST_NOW = new Date("2026-08-23T12:00:00.000Z");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysFromTestNow(days: number): Date {
  return new Date(DASHBOARD_TEST_NOW.getTime() + days * MS_PER_DAY);
}

export const EMPTY_PROVIDER: ProviderInfo = { id: null, name: null, domain: null };

export function makeProvider(
  id: string,
  name: string,
  domain: string | null = `${id}.com`,
): ProviderInfo {
  return { id, name, domain };
}

const CLOUDFLARE = makeProvider("cloudflare", "Cloudflare", "cloudflare.com");
const NAMECHEAP = makeProvider("namecheap", "Namecheap", "namecheap.com");
const VERCEL = makeProvider("vercel", "Vercel", "vercel.com");

export function makeTrackedDomain(
  overrides: Partial<TrackedDomainWithDetails> = {},
): TrackedDomainWithDetails {
  const domainName = overrides.domainName ?? "alpha.com";
  const tld = overrides.tld ?? domainName.split(".").at(-1) ?? "com";
  const id = overrides.id ?? `domain-${domainName.replaceAll(".", "-")}`;

  return {
    id,
    userId: "user-test",
    domainId: overrides.domainId ?? `dns-${id}`,
    domainName,
    tld,
    verified: true,
    verificationMethod: "dns_txt",
    verificationToken: "token",
    verificationStatus: "verified",
    verificationFailedAt: null,
    lastVerifiedAt: DASHBOARD_TEST_NOW,
    muted: false,
    createdAt: DASHBOARD_TEST_NOW,
    verifiedAt: DASHBOARD_TEST_NOW,
    archivedAt: null,
    expirationDate: daysFromTestNow(200),
    registrationDate: daysFromTestNow(-365),
    registrar: CLOUDFLARE,
    dns: EMPTY_PROVIDER,
    hosting: EMPTY_PROVIDER,
    email: EMPTY_PROVIDER,
    ca: EMPTY_PROVIDER,
    ...overrides,
  };
}

/**
 * Default catalog: healthy .com / expiring .io / expired .com / unverified .dev.
 */
export function makeDashboardDomains(): TrackedDomainWithDetails[] {
  return [
    makeTrackedDomain({
      id: "domain-alpha",
      domainName: "alpha.com",
      tld: "com",
      expirationDate: daysFromTestNow(200),
      registrar: CLOUDFLARE,
    }),
    makeTrackedDomain({
      id: "domain-beta",
      domainName: "beta.io",
      tld: "io",
      expirationDate: daysFromTestNow(Math.floor(EXPIRING_SOON_DAYS / 2)),
      registrar: NAMECHEAP,
      dns: CLOUDFLARE,
    }),
    makeTrackedDomain({
      id: "domain-gamma",
      domainName: "gamma.com",
      tld: "com",
      expirationDate: daysFromTestNow(-10),
      registrar: EMPTY_PROVIDER,
      hosting: VERCEL,
    }),
    makeTrackedDomain({
      id: "domain-pending",
      domainName: "pending.dev",
      tld: "dev",
      verified: false,
      verificationMethod: null,
      verificationStatus: "unverified",
      lastVerifiedAt: null,
      verifiedAt: null,
      expirationDate: null,
      registrationDate: null,
      registrar: EMPTY_PROVIDER,
      dns: EMPTY_PROVIDER,
      hosting: EMPTY_PROVIDER,
    }),
  ];
}

export function makePaginationDomains(count = 12): TrackedDomainWithDetails[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index).padStart(2, "0");
    return makeTrackedDomain({
      id: `page-${n}`,
      domainName: `site${n}.com`,
      tld: "com",
      expirationDate: daysFromTestNow(200),
    });
  });
}
