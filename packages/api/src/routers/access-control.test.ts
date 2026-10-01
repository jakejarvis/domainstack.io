/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

// Mock workflow/api to avoid starting real workflows if a module imports it
vi.mock("workflow/api", () => ({
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
    runId: "mock-run-id",
    returnValue: Promise.resolve({ success: true, data: {} }),
  }),
}));

const { appRouter, createCaller } = await import("../router");

import type { Context } from "../context";

// Every procedure that is intentionally callable without a session.
// Anything not listed here MUST reject anonymous callers.
const PUBLIC_PROCEDURES = new Set([
  "domain.getRegistration",
  "domain.getDnsRecords",
  "domain.getHosting",
  "domain.getCertificates",
  "domain.getHeaders",
  "domain.getSeo",
  "domain.getRawRegistration",
  "domain.getFavicon",
  "provider.getProviderIcon",
  "registrar.getPricing",
]);

const allPaths = Object.keys(appRouter._def.procedures).toSorted();
const protectedPaths = allPaths.filter((path) => !PUBLIC_PROCEDURES.has(path));

const anonymousContext: Context = { req: undefined, ip: "127.0.0.1", session: null };

function resolveProcedure(caller: unknown, path: string): (input: unknown) => Promise<unknown> {
  let node: any = caller;
  for (const segment of path.split(".")) {
    node = node[segment];
  }
  return node as (input: unknown) => Promise<unknown>;
}

describe("access control", () => {
  it("enumerates the router's procedures", () => {
    expect(allPaths.length).toBeGreaterThan(PUBLIC_PROCEDURES.size);
  });

  it("allowlists only procedures that exist", () => {
    for (const path of PUBLIC_PROCEDURES) {
      expect(allPaths, `stale public allowlist entry: ${path}`).toContain(path);
    }
  });

  it.each(protectedPaths)("%s rejects anonymous callers", async (path) => {
    const caller = createCaller(anonymousContext);
    const procedure = resolveProcedure(caller, path);

    await expect(procedure(undefined)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
