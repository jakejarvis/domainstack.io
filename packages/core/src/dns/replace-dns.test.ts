/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { DNS_RECORD_TYPES } from "@domainstack/constants";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { client } = await makePGliteDb();

const { db } = await import("@domainstack/db/client");
const { eq } = await import("@domainstack/db/drizzle");
const { replaceDns } = await import("@domainstack/db/queries/dns");
const { ensureDomainRecord } = await import("@domainstack/db/queries/domains");
const { dnsRecords } = await import("@domainstack/db/schema");

type ReplaceParams = Parameters<typeof replaceDns>[0];
type RecordsByType = ReplaceParams["recordsByType"];
type RecordInput = RecordsByType[(typeof DNS_RECORD_TYPES)[number]][number];

const FETCHED_AT = new Date("2026-01-01T00:00:00.000Z");
const EXPIRES_AT = new Date("2026-01-01T01:00:00.000Z");

function rec(name: string, value: string, ttl: number, priority?: number): RecordInput {
  return {
    name,
    value,
    ttl,
    priority: priority ?? null,
    isCloudflare: false,
    expiresAt: EXPIRES_AT,
  };
}

function set(partial: Partial<RecordsByType>): RecordsByType {
  const empty = Object.fromEntries(
    DNS_RECORD_TYPES.map((t) => [t, []]),
  ) as unknown as RecordsByType;
  return { ...empty, ...partial };
}

async function replace(domainId: string, recordsByType: RecordsByType) {
  await replaceDns({ domainId, resolver: "test-resolver", fetchedAt: FETCHED_AT, recordsByType });
}

async function readRows(domainId: string) {
  const rows = await db
    .select({
      type: dnsRecords.type,
      name: dnsRecords.name,
      value: dnsRecords.value,
      ttl: dnsRecords.ttl,
    })
    .from(dnsRecords)
    .where(eq(dnsRecords.domainId, domainId));
  return rows.toSorted((a, b) =>
    `${a.type}|${a.name}|${a.value}`.localeCompare(`${b.type}|${b.name}|${b.value}`),
  );
}

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

describe("replaceDns", () => {
  it("locks the parent domain row (FOR NO KEY UPDATE) before reading dns_records", async () => {
    // A two-writer race test is deliberately not used here: PGlite runs a single
    // connection and serializes transactions on it, so a concurrent test would pass
    // with or without the lock. Instead, observe the SQL issued inside the
    // transaction and assert the lock statement comes first.
    const domain = await ensureDomainRecord("lock-order.test");

    const captured: string[] = [];
    const originalTransaction = client.transaction.bind(client);
    (client as any).transaction = (callback: (tx: any) => Promise<unknown>) =>
      originalTransaction((tx) => {
        const originalQuery = tx.query.bind(tx);
        (tx as any).query = (sqlText: string, ...rest: unknown[]) => {
          captured.push(sqlText);
          return (originalQuery as any)(sqlText, ...rest);
        };
        return callback(tx);
      });

    try {
      await replace(domain.id, set({ A: [rec("lock-order.test", "192.0.2.1", 300)] }));
    } finally {
      (client as any).transaction = originalTransaction;
    }

    expect(captured.length).toBeGreaterThan(1);

    const lockIndex = captured.findIndex(
      (q) => /from "domains"/i.test(q) && /for no key update/i.test(q),
    );
    const firstDnsReadIndex = captured.findIndex(
      (q) => /^\s*select\b/i.test(q) && /from "dns_records"/i.test(q),
    );

    expect(lockIndex).toBe(0);
    expect(firstDnsReadIndex).toBeGreaterThan(lockIndex);
    // The lock targets exactly the one parent row by primary key.
    expect(captured[lockIndex]).toBe(
      'select "id" from "domains" where "domains"."id" = $1 for no key update',
    );
  });

  it("replaces the complete set: rows equal exactly the latest set, no union", async () => {
    const domain = await ensureDomainRecord("complete-set.test");

    await replace(
      domain.id,
      set({
        A: [rec("complete-set.test", "192.0.2.1", 300), rec("complete-set.test", "192.0.2.2", 300)],
        NS: [rec("complete-set.test", "ns1.example.net", 300)],
      }),
    );

    await replace(
      domain.id,
      set({
        // 192.0.2.2 overlaps with set A (ttl changes), 192.0.2.3 is new, 192.0.2.1 dropped
        A: [rec("complete-set.test", "192.0.2.2", 60), rec("complete-set.test", "192.0.2.3", 60)],
        MX: [rec("complete-set.test", "mail.example.net", 60, 10)],
      }),
    );

    expect(await readRows(domain.id)).toEqual([
      { type: "A", name: "complete-set.test", value: "192.0.2.2", ttl: 60 },
      { type: "A", name: "complete-set.test", value: "192.0.2.3", ttl: 60 },
      { type: "MX", name: "complete-set.test", value: "mail.example.net", ttl: 60 },
    ]);
  });

  it("deletes all rows for the domain when replaced with an empty set", async () => {
    const domain = await ensureDomainRecord("empty-set.test");

    await replace(
      domain.id,
      set({
        A: [rec("empty-set.test", "192.0.2.1", 300)],
        TXT: [rec("empty-set.test", "v=spf1 -all", 300)],
      }),
    );
    expect(await readRows(domain.id)).toHaveLength(2);

    await replace(domain.id, set({}));

    expect(await readRows(domain.id)).toEqual([]);
  });

  it("throws a descriptive error and writes nothing when the parent domain is missing", async () => {
    const missingId = crypto.randomUUID();

    await expect(
      replace(missingId, set({ A: [rec("missing.test", "192.0.2.1", 300)] })),
    ).rejects.toThrow(/does not exist/);

    const rows = await db.select({ id: dnsRecords.id }).from(dnsRecords);
    expect(rows).toEqual([]);
  });

  it("does not touch another domain's rows", async () => {
    const x = await ensureDomainRecord("domain-x.test");
    const y = await ensureDomainRecord("domain-y.test");

    await replace(y.id, set({ A: [rec("domain-y.test", "198.51.100.1", 300)] }));
    await replace(x.id, set({ A: [rec("domain-x.test", "192.0.2.1", 300)] }));

    await replace(x.id, set({ A: [rec("domain-x.test", "192.0.2.9", 30)] }));
    await replace(x.id, set({}));

    expect(await readRows(x.id)).toEqual([]);
    expect(await readRows(y.id)).toEqual([
      { type: "A", name: "domain-y.test", value: "198.51.100.1", ttl: 300 },
    ]);
  });
});
