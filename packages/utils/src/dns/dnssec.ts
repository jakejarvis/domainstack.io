/**
 * DNSSEC helpers: parsing DoH DS/DNSKEY answers, classifying validation
 * outcomes, and cross-checking registry DS data against DNS.
 */

import type {
  DnssecDsRecord,
  DnssecKey,
  DnssecRegistryCheck,
  DnssecResult,
  DnssecStatus,
  RegistrationDnssec,
} from "@domainstack/types";

import type { DohResult } from "./types";

const RCODE_NOERROR = 0;
const RCODE_SERVFAIL = 2;

/** DNSKEY Secure Entry Point flag (RFC 4034 §2.1.1, value 1) marks a key-signing key. */
const DNSKEY_SEP_FLAG = 1;

/**
 * Parse a DS answer's presentation data: `<key tag> <algorithm> <digest type> <digest>`.
 * The digest may be split into whitespace-separated chunks by some resolvers.
 */
export function parseDs(data: string): DnssecDsRecord | null {
  const [keyTag, algorithm, digestType, ...digestParts] = data.trim().split(/\s+/);
  const digest = digestParts.join("").toLowerCase();
  const parsed = {
    keyTag: Number(keyTag),
    algorithm: Number(algorithm),
    digestType: Number(digestType),
  };
  if (
    !digest ||
    !Number.isInteger(parsed.keyTag) ||
    !Number.isInteger(parsed.algorithm) ||
    !Number.isInteger(parsed.digestType)
  ) {
    return null;
  }
  return { ...parsed, digest };
}

/**
 * Parse a DNSKEY answer's presentation data: `<flags> <protocol> <algorithm> <base64 key>`.
 * The public key itself is not retained.
 */
export function parseDnskey(data: string): DnssecKey | null {
  const [flagsStr, protocolStr, algorithmStr, ...keyParts] = data.trim().split(/\s+/);
  const flags = Number(flagsStr);
  const protocol = Number(protocolStr);
  const algorithm = Number(algorithmStr);
  if (
    keyParts.length === 0 ||
    !Number.isInteger(flags) ||
    !Number.isInteger(protocol) ||
    !Number.isInteger(algorithm)
  ) {
    return null;
  }
  return { flags, protocol, algorithm, isKsk: (flags & DNSKEY_SEP_FLAG) === DNSKEY_SEP_FLAG };
}

/**
 * Classify DNSSEC status from a validating query and, when that one failed
 * with SERVFAIL, the same query with checking disabled.
 *
 * A validating resolver returns SERVFAIL for a bogus zone; if the answer
 * resolves once validation is skipped, the failure was DNSSEC, not the zone.
 */
export function classifyDnssec(validated: DohResult, unchecked?: DohResult): DnssecStatus {
  if (validated.rcode === RCODE_NOERROR) {
    return validated.ad ? "secure" : "insecure";
  }
  if (validated.rcode === RCODE_SERVFAIL && unchecked?.rcode === RCODE_NOERROR) {
    return "bogus";
  }
  return "indeterminate";
}

function dsKey(ds: { keyTag?: number; algorithm?: number; digestType?: number; digest?: string }) {
  return `${ds.keyTag}:${ds.algorithm}:${ds.digestType}:${ds.digest?.toLowerCase()}`;
}

/**
 * Compare the registry's view of DNSSEC (RDAP `secureDNS`) with the DS records
 * actually published in DNS.
 *
 * With DS detail from the registry, a mismatch means the two sets share no
 * record (a partial overlap is a normal key rollover). Without detail (WHOIS
 * fallback only reports `enabled`), it means signed-vs-DS-presence disagree.
 */
export function compareRegistryDs(
  dnsDs: DnssecDsRecord[],
  registry: RegistrationDnssec,
): DnssecRegistryCheck {
  const { enabled } = registry;
  const registryDs = (registry.dsRecords ?? []).filter(
    (r) =>
      r.keyTag !== undefined &&
      r.algorithm !== undefined &&
      r.digestType !== undefined &&
      r.digest !== undefined,
  );

  if (registryDs.length > 0) {
    if (dnsDs.length === 0) {
      return { enabled, mismatch: true, reason: "ds_missing_in_dns" };
    }
    const published = new Set(dnsDs.map(dsKey));
    const overlaps = registryDs.some((r) => published.has(dsKey(r)));
    return overlaps
      ? { enabled, mismatch: false }
      : { enabled, mismatch: true, reason: "ds_differs" };
  }

  if (enabled && dnsDs.length === 0) {
    return { enabled, mismatch: true, reason: "ds_missing_in_dns" };
  }
  if (!enabled && dnsDs.length > 0) {
    return { enabled, mismatch: true, reason: "ds_missing_at_registry" };
  }
  return { enabled, mismatch: false };
}

/**
 * Attach the registry cross-check to a DNSSEC result. Leaves the result
 * unchanged when the registry's view is unknown (no registration data yet).
 */
export function withRegistryCheck(
  dnssec: DnssecResult,
  registry: RegistrationDnssec | null | undefined,
): DnssecResult {
  if (!registry) return dnssec;
  return { ...dnssec, registry: compareRegistryDs(dnssec.ds, registry) };
}
