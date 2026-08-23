import { EXPIRING_SOON_DAYS } from "@domainstack/constants";
import type { ProviderInfo, ResumeDomainData, TrackedDomainWithDetails } from "@domainstack/types";

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

function cloneProvider(provider: ProviderInfo): ProviderInfo {
  return { id: provider.id, name: provider.name, domain: provider.domain };
}

function cloneDate(date: Date | null | undefined): Date | null {
  return date ? new Date(date.getTime()) : null;
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

  const domain = {
    id,
    userId: "user-test",
    domainId: overrides.domainId ?? `dns-${id}`,
    domainName,
    tld,
    verified: true,
    verificationMethod: "dns_txt" as TrackedDomainWithDetails["verificationMethod"],
    verificationToken: "token",
    verificationStatus: "verified" as TrackedDomainWithDetails["verificationStatus"],
    verificationFailedAt: null as Date | null,
    lastVerifiedAt: cloneDate(DASHBOARD_TEST_NOW),
    muted: false,
    createdAt: cloneDate(DASHBOARD_TEST_NOW)!,
    verifiedAt: cloneDate(DASHBOARD_TEST_NOW),
    archivedAt: null as Date | null,
    expirationDate: daysFromTestNow(200),
    registrationDate: daysFromTestNow(-365),
    registrar: cloneProvider(CLOUDFLARE),
    dns: cloneProvider(EMPTY_PROVIDER),
    hosting: cloneProvider(EMPTY_PROVIDER),
    email: cloneProvider(EMPTY_PROVIDER),
    ca: cloneProvider(EMPTY_PROVIDER),
    ...overrides,
  };

  return {
    ...domain,
    verificationFailedAt: cloneDate(domain.verificationFailedAt),
    lastVerifiedAt: cloneDate(domain.lastVerifiedAt),
    createdAt: cloneDate(domain.createdAt)!,
    verifiedAt: cloneDate(domain.verifiedAt),
    archivedAt: cloneDate(domain.archivedAt),
    expirationDate: cloneDate(domain.expirationDate),
    registrationDate: cloneDate(domain.registrationDate),
    registrar: cloneProvider(domain.registrar),
    dns: cloneProvider(domain.dns),
    hosting: cloneProvider(domain.hosting),
    email: cloneProvider(domain.email),
    ca: cloneProvider(domain.ca),
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

export function makeResumeDomain(overrides: Partial<ResumeDomainData> = {}): ResumeDomainData {
  return {
    id: overrides.id ?? "domain-pending",
    domainName: overrides.domainName ?? "pending.dev",
    verificationToken: overrides.verificationToken ?? "token-pending",
    verificationMethod: overrides.verificationMethod ?? "dns_txt",
  };
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
