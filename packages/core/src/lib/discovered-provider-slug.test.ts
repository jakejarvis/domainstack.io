/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const { resolveOrCreateProviderId } = await import("@domainstack/db/queries/providers");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

describe("resolveOrCreateProviderId with non-Latin names", () => {
  it("gives two non-Latin registrars their own rows", async () => {
    const a = await resolveOrCreateProviderId({
      category: "registrar",
      name: "阿里云计算有限公司（万网）",
      domain: "www.aliyun.com",
    });
    const b = await resolveOrCreateProviderId({
      category: "registrar",
      name: "北京新网数码信息技术有限公司",
      domain: "www.xinnet.com",
    });
    expect(a).not.toBe(b);
  });

  it("still reuses a row for the same non-Latin name", async () => {
    const input = {
      category: "registrar" as const,
      name: "阿里云计算有限公司（万网）",
      domain: "www.aliyun.com",
    };
    const a = await resolveOrCreateProviderId(input);
    const b = await resolveOrCreateProviderId(input);
    expect(b).toBe(a);
  });
});
