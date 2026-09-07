/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { updateLastAccessed, waitUntil } = vi.hoisted(() => ({
  updateLastAccessed: vi.fn<(domain: string) => Promise<boolean>>(),
  waitUntil: vi.fn<(work: Promise<unknown>) => void>(),
}));

vi.mock("@domainstack/db/queries/domains", () => ({
  updateLastAccessed,
}));

vi.mock("@vercel/functions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/functions")>()),
  waitUntil,
}));

import { createCallerFactory, t } from "../trpc";
import { withDomainAccessUpdate } from "./domain-access";

const inputSchema = z.object({ domain: z.string() });

const createCallerAfterInput = createCallerFactory(
  t.router({
    lookup: t.procedure
      .input(inputSchema)
      .use(withDomainAccessUpdate)
      .query(({ input }) => input),
  }),
);

const createCallerBeforeInput = createCallerFactory(
  t.router({
    lookup: t.procedure
      .use(withDomainAccessUpdate)
      .input(inputSchema)
      .query(({ input }) => input),
  }),
);

function lookupAfterInput(domain: string) {
  return createCallerAfterInput({ req: undefined, ip: null, session: null }).lookup({ domain });
}

function lookupBeforeInput(domain: string) {
  return createCallerBeforeInput({ req: undefined, ip: null, session: null }).lookup({ domain });
}

describe("withDomainAccessUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateLastAccessed.mockResolvedValue(true);
  });

  it("records access when middleware is attached after .input()", async () => {
    await expect(lookupAfterInput("example.com")).resolves.toEqual({ domain: "example.com" });

    expect(updateLastAccessed).toHaveBeenCalledWith("example.com");
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("still records access when middleware is attached before .input()", async () => {
    await expect(lookupBeforeInput("example.com")).resolves.toEqual({ domain: "example.com" });

    expect(updateLastAccessed).toHaveBeenCalledWith("example.com");
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});
