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
 * Determine a domain's DNSSEC status and published DS/DNSKEY sets from one provider.
 * Throws on transport-level failures; callers decide the fallback.
 */
export async function fetchDnssec(domain: string, provider: DohProvider): Promise<DnssecFetchData> {
  const [validated, dsResult, dnskeyResult] = await Promise.all([
    queryDoh(provider, domain, "SOA", { dnssec: true }),
    queryDoh(provider, domain, "DS", { dnssec: true, checkingDisabled: true }),
    queryDoh(provider, domain, "DNSKEY", { dnssec: true, checkingDisabled: true }),
  ]);

  // Only a SERVFAIL needs the unchecked comparison to tell "bogus" from "broken".
  const unchecked =
    validated.rcode === 2
      ? await queryDoh(provider, domain, "SOA", { dnssec: true, checkingDisabled: true })
      : undefined;

  const dsAnswers = dsResult.rcode === 0 ? dsResult.answers : [];
  const dnskeyAnswers = dnskeyResult.rcode === 0 ? dnskeyResult.answers : [];

  const ds: DnssecDsRecord[] = parseAnswers(dsAnswers, DNS_TYPE_NUMBERS.DS, parseDs);
  const dnskeys: DnssecKey[] = parseAnswers(dnskeyAnswers, DNS_TYPE_NUMBERS.DNSKEY, parseDnskey);

  const ttls = [...dsAnswers, ...dnskeyAnswers]
    .filter((a) => a.type === DNS_TYPE_NUMBERS.DS || a.type === DNS_TYPE_NUMBERS.DNSKEY)
    .map((a) => a.TTL)
    .filter((ttl) => Number.isFinite(ttl) && ttl > 0);

  return {
    dnssec: { status: classifyDnssec(validated, unchecked), ds, dnskeys },
    ttl: ttls.length > 0 ? Math.min(...ttls) : undefined,
  };
}
