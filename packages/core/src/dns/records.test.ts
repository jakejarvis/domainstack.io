/* @vitest-environment node */

import type { DnsRecord } from "@domainstack/types";
import { describe, expect, it } from "vitest";
import {
  deduplicateDnsRecords,
  deduplicateDnsRecordsByValue,
  makeDnsRecordKey,
  sortDnsRecordsByType,
  sortDnsRecordsForType,
} from "./records";

describe("makeDnsRecordKey", () => {
  it("creates a key for A records", () => {
    const key = makeDnsRecordKey("A", "example.com", "1.2.3.4", undefined);
    expect(key).toBe("A|example.com|1.2.3.4");
  });

  it("creates a key for MX records with priority", () => {
    const key = makeDnsRecordKey("MX", "example.com", "mail.example.com", 10);
    expect(key).toBe("MX|example.com|mail.example.com|10");
  });

  it("normalizes name to lowercase", () => {
    const key = makeDnsRecordKey("A", "EXAMPLE.COM", "1.2.3.4", undefined);
    expect(key).toBe("A|example.com|1.2.3.4");
  });

  it("preserves case for TXT values", () => {
    const key = makeDnsRecordKey(
      "TXT",
      "example.com",
      "v=spf1 include:_spf.Google.com",
      undefined,
    );
    expect(key).toBe("TXT|example.com|v=spf1 include:_spf.Google.com");
  });

  it("normalizes value to lowercase for non-TXT records", () => {
    const key = makeDnsRecordKey("A", "example.com", "  1.2.3.4  ", undefined);
    expect(key).toBe("A|example.com|1.2.3.4");
  });
});

describe("deduplicateDnsRecords", () => {
  it("removes duplicate records", () => {
    const records: DnsRecord[] = [
      { type: "A", name: "example.com", value: "1.2.3.4" },
      { type: "A", name: "example.com", value: "1.2.3.4" },
    ];
    const result = deduplicateDnsRecords(records);
    expect(result).toHaveLength(1);
  });

  it("keeps records with different values", () => {
    const records: DnsRecord[] = [
      { type: "A", name: "example.com", value: "1.2.3.4" },
      { type: "A", name: "example.com", value: "5.6.7.8" },
    ];
    const result = deduplicateDnsRecords(records);
    expect(result).toHaveLength(2);
  });

  it("keeps MX records with different priorities", () => {
    const records: DnsRecord[] = [
      {
        type: "MX",
        name: "example.com",
        value: "mail.example.com",
        priority: 10,
      },
      {
        type: "MX",
        name: "example.com",
        value: "mail.example.com",
        priority: 20,
      },
    ];
    const result = deduplicateDnsRecords(records);
    expect(result).toHaveLength(2);
  });

  it("is case-insensitive for non-TXT record values", () => {
    const records: DnsRecord[] = [
      {
        type: "A",
        name: "example.com",
        value: "mail.EXAMPLE.com",
      },
      {
        type: "A",
        name: "example.com",
        value: "mail.example.COM",
      },
    ];
    const result = deduplicateDnsRecords(records);
    expect(result).toHaveLength(1);
  });

  it("is case-sensitive for TXT record values", () => {
    const records: DnsRecord[] = [
      {
        type: "TXT",
        name: "example.com",
        value: "VERIFICATION=abc",
      },
      {
        type: "TXT",
        name: "example.com",
        value: "verification=abc",
      },
    ];
    const result = deduplicateDnsRecords(records);
    expect(result).toHaveLength(2);
  });
});

describe("deduplicateDnsRecordsByValue", () => {
  it("deduplicates by value only", () => {
    const records: DnsRecord[] = [
      { type: "A", name: "example.com", value: "1.2.3.4" },
      { type: "A", name: "other.com", value: "1.2.3.4" },
    ];
    const result = deduplicateDnsRecordsByValue(records);
    expect(result).toHaveLength(1);
  });
});

describe("sortDnsRecordsForType", () => {
  it("sorts MX records by priority first", () => {
    const records: DnsRecord[] = [
      {
        type: "MX",
        name: "example.com",
        value: "mail2.example.com",
        priority: 20,
      },
      {
        type: "MX",
        name: "example.com",
        value: "mail1.example.com",
        priority: 10,
      },
    ];
    const result = sortDnsRecordsForType(records, "MX");
    expect(result[0].priority).toBe(10);
    expect(result[1].priority).toBe(20);
  });

  it("sorts non-MX records alphabetically by value", () => {
    const records: DnsRecord[] = [
      { type: "A", name: "example.com", value: "5.6.7.8" },
      { type: "A", name: "example.com", value: "1.2.3.4" },
    ];
    const result = sortDnsRecordsForType(records, "A");
    expect(result[0].value).toBe("1.2.3.4");
    expect(result[1].value).toBe("5.6.7.8");
  });
});

describe("sortDnsRecordsByType", () => {
  it("sorts records by type order", () => {
    const records: DnsRecord[] = [
      { type: "TXT", name: "example.com", value: "v=spf1" },
      { type: "A", name: "example.com", value: "1.2.3.4" },
      {
        type: "MX",
        name: "example.com",
        value: "mail.example.com",
        priority: 10,
      },
    ];
    const order = ["A", "MX", "TXT"] as const;
    const result = sortDnsRecordsByType(records, order);
    expect(result[0].type).toBe("A");
    expect(result[1].type).toBe("MX");
    expect(result[2].type).toBe("TXT");
  });
});
