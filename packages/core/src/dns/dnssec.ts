/**
 * DNSSEC validation via DoH.
 *
 * Validity comes from a validating SOA query (the resolver's AD flag). The DS
 * and DNSKEY sets are fetched with checking disabled so they are still listed
 * for a bogus zone, where a validating query would just SERVFAIL.
 */

import { DNS_TYPE_NUMBERS } from "@domainstack/constants";
import type { DnssecDsRecord, DnssecKey, DnssecResult, DohProvider } from "@domainstack/types";
import {
  classifyDnssec,
  type DnsAnswer,
  parseDnskey,
  parseDs,
  queryDoh,
} from "@domainstack/utils/dns";

export interface DnssecFetchData {
  dnssec: DnssecResult;
  /** Smallest TTL among the SOA, DS, and DNSKEY answers that established `dnssec`, for cache expiry. */
  ttl?: number;
  /**
   * Whether `dnssec.ds`/`dnssec.dnskeys` reflect a real NOERROR observation
   * this round, rather than an empty array standing in for a failed or
   * non-NOERROR DS/DNSKEY query. False means `ds`/`dnskeys` must not be
   * treated as "confirmed empty" — callers should keep whatever they
   * previously knew instead of overwriting it with these empty sets.
   */
  dsAvailable: boolean;
  dnskeysAvailable: boolean;
}

/** Result to store when DNSSEC could not be determined; the DNS records themselves are still valid. */
export const INDETERMINATE_DNSSEC: DnssecFetchData = {
  dnssec: { status: "indeterminate", ds: [], dnskeys: [] },
  dsAvailable: false,
  dnskeysAvailable: false,
};

function parseAnswers<T>(
  answers: DnsAnswer[],
  typeNumber: number,
  parse: (data: string) => T | null,
): T[] {
  return answers
    .filter((a) => a.type === typeNumber)
    .map((a) => parse(a.data))
    .filter((parsed): parsed is T => parsed !== null);
}

/**
 * TTLs of answers matching `typeNumber`. With `do=1` set, a resolver may
 * bundle the covering RRSIG into the same answer section; its TTL must not
 * be mistaken for the record's own, so this filters by type rather than
 * using every answer's TTL indiscriminately.
 */
function ttlsOf(answers: DnsAnswer[], typeNumber: number): number[] {
  return answers
    .filter((a) => a.type === typeNumber)
    .map((a) => a.TTL)
    .filter((ttl) => Number.isFinite(ttl) && ttl > 0);
}

/** DNS RCODE 2 — server failure; a validating resolver's answer for a bogus zone. */
const RCODE_SERVFAIL = 2;

/**
 * Determine a domain's DNSSEC status and published DS/DNSKEY sets from one provider.
 * Throws on transport-level failures; callers decide the fallback.
 */
export async function fetchDnssec(domain: string, provider: DohProvider): Promise<DnssecFetchData> {
  // Start the DS/DNSKEY metadata queries alongside the SOA query — they're
  // independent, so awaiting SOA first would add an avoidable round trip.
  // They're best-effort: `allSettled` so a transport failure here can't
  // discard the SOA-derived status below.
  const metadataSettled = Promise.allSettled([
    queryDoh(provider, domain, "DS", { dnssec: true, checkingDisabled: true }),
    queryDoh(provider, domain, "DNSKEY", { dnssec: true, checkingDisabled: true }),
  ]);

  const validated = await queryDoh(provider, domain, "SOA", { dnssec: true });

  // Only a SERVFAIL needs the unchecked comparison to tell "bogus" from "broken".
  const unchecked =
    validated.rcode === RCODE_SERVFAIL
      ? await queryDoh(provider, domain, "SOA", { dnssec: true, checkingDisabled: true })
      : undefined;

  const [dsSettled, dnskeySettled] = await metadataSettled;

  // Available only on a real NOERROR answer: a rejected promise or any other
  // RCODE (SERVFAIL, REFUSED, …) means we don't actually know the DS/DNSKEY
  // set, and must not report it as an observed-empty one.
  const dsAvailable = dsSettled.status === "fulfilled" && dsSettled.value.rcode === 0;
  const dnskeysAvailable = dnskeySettled.status === "fulfilled" && dnskeySettled.value.rcode === 0;

  const dsAnswers = dsAvailable && dsSettled.status === "fulfilled" ? dsSettled.value.answers : [];
  const dnskeyAnswers =
    dnskeysAvailable && dnskeySettled.status === "fulfilled" ? dnskeySettled.value.answers : [];

  const ds: DnssecDsRecord[] = parseAnswers(dsAnswers, DNS_TYPE_NUMBERS.DS, parseDs);
  const dnskeys: DnssecKey[] = parseAnswers(dnskeyAnswers, DNS_TYPE_NUMBERS.DNSKEY, parseDnskey);

  // Include the SOA answers too: a short SOA TTL must not be outlived by a
  // longer DS/DNSKEY TTL, or the cached status could survive past its source.
  const ttls = [
    ...ttlsOf(validated.answers, DNS_TYPE_NUMBERS.SOA),
    ...ttlsOf(unchecked?.answers ?? [], DNS_TYPE_NUMBERS.SOA),
    ...ttlsOf(dsAnswers, DNS_TYPE_NUMBERS.DS),
    ...ttlsOf(dnskeyAnswers, DNS_TYPE_NUMBERS.DNSKEY),
  ];

  return {
    dnssec: { status: classifyDnssec(validated, unchecked), ds, dnskeys },
    ttl: ttls.length > 0 ? Math.min(...ttls) : undefined,
    dsAvailable,
    dnskeysAvailable,
  };
}
