/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const { upsertCatalogProvider, resolveOrCreateProviderId, clearCatalogProviderMemo } =
  await import("@domainstack/db/queries/providers");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
  clearCatalogProviderMemo();
});

describe("upsertCatalogProvider identity", () => {
  it("keeps the id when an entry is renamed", async () => {
    const original = {
      category: "dns" as const,
      name: "Cloudflare",
      domain: "cloudflare.com",
      rule: { kind: "nsSuffix" as const, suffix: "ns.cloudflare.com" },
    };
    const a = await upsertCatalogProvider(original, [original]);

    const renamed = { ...original, name: "Cloudflare DNS" };
    const b = await upsertCatalogProvider(renamed, [renamed]);

    expect(b.id).toBe(a.id);
    expect(b.name).toBe("Cloudflare DNS");
    expect(b.slug).toBe("cloudflare-dns");
  });

  it("keeps two listed entries that share a domain separate", async () => {
    const r53 = {
      category: "dns" as const,
      name: "Route 53",
      domain: "aws.amazon.com",
      rule: { kind: "nsSuffix" as const, suffix: "awsdns.com" },
    };
    const lightsail = {
      category: "dns" as const,
      name: "Lightsail DNS",
      domain: "aws.amazon.com",
      rule: { kind: "nsSuffix" as const, suffix: "lightsail.aws" },
    };
    const entries = [r53, lightsail];

    const a = await upsertCatalogProvider(r53, entries);
    const b = await upsertCatalogProvider(lightsail, entries);

    expect(b.id).not.toBe(a.id);
    const again = await upsertCatalogProvider(r53, entries);
    expect(again.id).toBe(a.id);
    expect(again.name).toBe("Route 53");
  });

  it("adopts the GeoIP-discovered hosting row for a new hosting entry", async () => {
    const id = await resolveOrCreateProviderId({
      category: "hosting",
      name: "Hetzner Online GmbH",
      domain: "hetzner.com",
    });

    const entry = {
      category: "hosting" as const,
      name: "Hetzner",
      domain: "hetzner.com",
      rule: { kind: "headerPresent" as const, name: "x-hetzner" },
    };
    const row = await upsertCatalogProvider(entry, [entry]);

    expect(row.id).toBe(id);
    expect(row.source).toBe("catalog");
  });

  it("still inserts a brand-new entry", async () => {
    const id = await resolveOrCreateProviderId({
      category: "hosting",
      name: "Hetzner Online GmbH",
      domain: "hetzner.com",
    });

    const entry = {
      category: "hosting" as const,
      name: "Fly.io",
      domain: "fly.io",
      rule: { kind: "headerPresent" as const, name: "fly-request-id" },
    };
    const row = await upsertCatalogProvider(entry, [entry]);

    expect(row.id).not.toBe(id);
    expect(row.source).toBe("catalog");
  });
});
