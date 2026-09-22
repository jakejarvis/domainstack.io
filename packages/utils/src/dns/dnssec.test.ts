/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { DnssecResult } from "@domainstack/types";

import {
  classifyDnssec,
  compareRegistryDs,
  parseDnskey,
  parseDs,
  withRegistryCheck,
} from "./dnssec";
import type { DohResult } from "./types";

const result = (rcode: number, ad = false): DohResult => ({ rcode, ad, answers: [] });

describe("parseDs", () => {
  it("parses a DS record", () => {
    expect(parseDs("2371 13 2 CE0EB9E59E")).toEqual({
      keyTag: 2371,
      algorithm: 13,
      digestType: 2,
      digest: "ce0eb9e59e",
    });
  });

  it("joins a digest split into chunks", () => {
    expect(parseDs("1 8 2 AAAA BBBB")?.digest).toBe("aaaabbbb");
  });

  it("rejects malformed data", () => {
    expect(parseDs("")).toBeNull();
    expect(parseDs("x 13 2 AB")).toBeNull();
    expect(parseDs("2371 13 2")).toBeNull();
  });

  it("rejects a non-hex digest", () => {
    expect(parseDs("2371 13 2 xyz")).toBeNull();
    expect(parseDs("2371 13 2 CE0EB9E5 9E ZZ")).toBeNull();
  });
});

describe("parseDnskey", () => {
  it("flags a KSK by the SEP bit", () => {
    expect(parseDnskey("257 3 13 mdsswUyr3DPW")).toEqual({
      flags: 257,
      protocol: 3,
      algorithm: 13,
      isKsk: true,
    });
  });

  it("does not flag a ZSK", () => {
    expect(parseDnskey("256 3 13 oJMRESz5E4gY")?.isKsk).toBe(false);
  });

  it("rejects malformed data", () => {
    expect(parseDnskey("257 3 13")).toBeNull();
    expect(parseDnskey("nope")).toBeNull();
  });
});

describe("classifyDnssec", () => {
  it("is secure when a validating NOERROR sets AD", () => {
    expect(classifyDnssec(result(0, true))).toBe("secure");
  });

  it("is insecure when NOERROR without AD", () => {
    expect(classifyDnssec(result(0, false))).toBe("insecure");
  });

  it("is bogus when SERVFAIL resolves with checking disabled", () => {
    expect(classifyDnssec(result(2), result(0))).toBe("bogus");
  });

  it("is indeterminate when SERVFAIL persists with checking disabled", () => {
    expect(classifyDnssec(result(2), result(2))).toBe("indeterminate");
  });

  it("is indeterminate when SERVFAIL and no unchecked result", () => {
    expect(classifyDnssec(result(2))).toBe("indeterminate");
  });

  it("is indeterminate for other RCODEs", () => {
    expect(classifyDnssec(result(3))).toBe("indeterminate");
    expect(classifyDnssec(result(5))).toBe("indeterminate");
  });
});

describe("compareRegistryDs", () => {
  const ds = { keyTag: 2371, algorithm: 13, digestType: 2, digest: "abcd" };

  it("matches identical DS records case-insensitively", () => {
    expect(
      compareRegistryDs([ds], { enabled: true, dsRecords: [{ ...ds, digest: "ABCD" }] }),
    ).toEqual({
      enabled: true,
      mismatch: false,
    });
  });

  it("tolerates a partial overlap (key rollover)", () => {
    const other = { ...ds, keyTag: 1, digest: "ffff" };
    expect(compareRegistryDs([ds, other], { enabled: true, dsRecords: [ds] }).mismatch).toBe(false);
  });

  it("flags disjoint DS sets", () => {
    expect(
      compareRegistryDs([ds], { enabled: true, dsRecords: [{ ...ds, digest: "ffff" }] }),
    ).toEqual({ enabled: true, mismatch: true, reason: "ds_differs" });
  });

  it("flags registry DS missing from DNS", () => {
    expect(compareRegistryDs([], { enabled: true, dsRecords: [ds] })).toEqual({
      enabled: true,
      mismatch: true,
      reason: "ds_missing_in_dns",
    });
  });

  it("falls back to enabled vs DS presence when the registry has no DS detail", () => {
    expect(compareRegistryDs([], { enabled: true })).toEqual({
      enabled: true,
      mismatch: true,
      reason: "ds_missing_in_dns",
    });
    expect(compareRegistryDs([ds], { enabled: false })).toEqual({
      enabled: false,
      mismatch: true,
      reason: "ds_missing_at_registry",
    });
    expect(compareRegistryDs([ds], { enabled: true })).toEqual({ enabled: true, mismatch: false });
    expect(compareRegistryDs([], { enabled: false })).toEqual({ enabled: false, mismatch: false });
  });

  it("ignores registry DS records with missing fields", () => {
    expect(compareRegistryDs([], { enabled: false, dsRecords: [{ keyTag: 1 }] }).mismatch).toBe(
      false,
    );
  });
});

describe("withRegistryCheck", () => {
  const ds = { keyTag: 2371, algorithm: 13, digestType: 2, digest: "abcd" };
  const secure: DnssecResult = { status: "secure", ds: [ds], dnskeys: [] };

  it("passes the result through unchanged when the registry is unknown", () => {
    expect(withRegistryCheck(secure, null)).toBe(secure);
    expect(withRegistryCheck(secure, undefined)).toBe(secure);
  });

  it("attaches the registry cross-check when both sides are known", () => {
    expect(withRegistryCheck(secure, { enabled: true, dsRecords: [ds] })).toEqual({
      ...secure,
      registry: { enabled: true, mismatch: false },
    });
  });

  it("skips the comparison for an indeterminate result, even with a known registry", () => {
    const indeterminate: DnssecResult = { status: "indeterminate", ds: [], dnskeys: [] };

    // An indeterminate observation has no reliable (possibly empty) DS set, so
    // comparing it would report a false "missing in DNS" mismatch.
    expect(withRegistryCheck(indeterminate, { enabled: true, dsRecords: [ds] })).toBe(
      indeterminate,
    );
  });

  it("skips the comparison when dsAvailable is false, even with a determinate status", () => {
    // e.g. a determinate SOA result whose DS query specifically failed: `ds`
    // here is a stand-in for "unknown", not a confirmed-empty set.
    const secureButDsUnavailable: DnssecResult = { status: "secure", ds: [], dnskeys: [] };

    expect(
      withRegistryCheck(
        secureButDsUnavailable,
        { enabled: true, dsRecords: [ds] },
        { dsAvailable: false },
      ),
    ).toBe(secureButDsUnavailable);
  });

  it("compares by default (dsAvailable defaults to true)", () => {
    expect(withRegistryCheck(secure, { enabled: true, dsRecords: [ds] }, {})).toEqual({
      ...secure,
      registry: { enabled: true, mismatch: false },
    });
  });

  it("passes an input dnskeysAvailable flag through untouched — it doesn't factor into the DS comparison", () => {
    const withUnavailableDnskeys: DnssecResult = {
      status: "secure",
      ds: [ds],
      dnskeys: [],
      dnskeysAvailable: false,
    };

    expect(withRegistryCheck(withUnavailableDnskeys, { enabled: true, dsRecords: [ds] })).toEqual({
      ...withUnavailableDnskeys,
      registry: { enabled: true, mismatch: false },
    });
  });
});
