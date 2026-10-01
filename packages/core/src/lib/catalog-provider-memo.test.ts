/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { client } = await makePGliteDb();

const { upsertCatalogProvider, clearCatalogProviderMemo } =
  await import("@domainstack/db/queries/providers");

const provider = {
  category: "dns" as const,
  name: "Memo DNS",
  domain: "memo-dns.example",
  rule: { kind: "nsSuffix" as const, suffix: "memo-dns.example" },
};

// Record the SQL text of every statement `fn` issues by wrapping `client.query`.
async function captureStatements(fn: () => Promise<unknown>): Promise<string[]> {
  const captured: string[] = [];
  const originalQuery = client.query.bind(client);
  (client as any).query = (sqlText: string, ...rest: unknown[]) => {
    captured.push(sqlText);
    return (originalQuery as any)(sqlText, ...rest);
  };
  try {
    await fn();
  } finally {
    (client as any).query = originalQuery;
  }
  return captured;
}

const isProviderSelect = (q: string) => /^\s*select\b/i.test(q) && /from "providers"/i.test(q);

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

describe("upsertCatalogProvider memo", () => {
  it("issues one select in total for repeated calls with an unchanged provider", async () => {
    // The first call inserts the row, so it is not yet memoized.
    await upsertCatalogProvider(provider);

    const statements = await captureStatements(async () => {
      const a = await upsertCatalogProvider(provider);
      const b = await upsertCatalogProvider(provider);
      expect(b.id).toBe(a.id);
    });

    expect(statements.filter(isProviderSelect)).toHaveLength(1);
  });

  it("reads again after clearCatalogProviderMemo()", async () => {
    await upsertCatalogProvider(provider);
    await upsertCatalogProvider(provider);

    clearCatalogProviderMemo();

    const statements = await captureStatements(() => upsertCatalogProvider(provider));
    expect(statements.filter(isProviderSelect)).toHaveLength(1);
  });
});
