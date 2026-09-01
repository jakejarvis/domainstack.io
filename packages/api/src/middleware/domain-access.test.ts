/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { updateLastAccessed, scheduleBackground } = vi.hoisted(() => ({
  updateLastAccessed: vi.fn<(domain: string) => Promise<boolean>>(),
  scheduleBackground: vi.fn<(work: Promise<unknown>) => Promise<void>>(async (work) => {
    await work;
  }),
}));

vi.mock("@domainstack/db/queries", () => ({
  updateLastAccessed,
}));

vi.mock("../wait-until", () => ({
  scheduleBackground,
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
    expect(scheduleBackground).toHaveBeenCalledTimes(1);
    expect(scheduleBackground).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("still records access when middleware is attached before .input()", async () => {
    await expect(lookupBeforeInput("example.com")).resolves.toEqual({ domain: "example.com" });

    expect(updateLastAccessed).toHaveBeenCalledWith("example.com");
    expect(scheduleBackground).toHaveBeenCalledTimes(1);
  });
});
