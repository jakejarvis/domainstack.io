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
  /** Smallest TTL among the DS and DNSKEY answers, for cache expiry. */
  ttl?: number;
}

/** Result to store when DNSSEC could not be determined; the DNS records themselves are still valid. */
export const INDETERMINATE_DNSSEC: DnssecFetchData = {
  dnssec: { status: "indeterminate", ds: [], dnskeys: [] },
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
  // The SOA query establishes the status; it must not be discarded just because
  // the (best-effort, supplementary) DS/DNSKEY metadata queries fail below.
  const validated = await queryDoh(provider, domain, "SOA", { dnssec: true });

  // Only a SERVFAIL needs the unchecked comparison to tell "bogus" from "broken".
  const unchecked =
    validated.rcode === RCODE_SERVFAIL
      ? await queryDoh(provider, domain, "SOA", { dnssec: true, checkingDisabled: true })
      : undefined;

  const [dsSettled, dnskeySettled] = await Promise.allSettled([
    queryDoh(provider, domain, "DS", { dnssec: true, checkingDisabled: true }),
    queryDoh(provider, domain, "DNSKEY", { dnssec: true, checkingDisabled: true }),
  ]);

  const dsAnswers =
    dsSettled.status === "fulfilled" && dsSettled.value.rcode === 0 ? dsSettled.value.answers : [];
  const dnskeyAnswers =
    dnskeySettled.status === "fulfilled" && dnskeySettled.value.rcode === 0
      ? dnskeySettled.value.answers
      : [];

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
  };
}
