import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const log = vi.hoisted(() => ({
  error: vi.fn<(...args: unknown[]) => void>(),
  info: vi.fn<(...args: unknown[]) => void>(),
  warn: vi.fn<(...args: unknown[]) => void>(),
}));

vi.mock("@domainstack/logger", () => ({
  createLogger: () => log,
}));

const { publicProcedure } = await import("../procedures");
const { t } = await import("../trpc");

const router = t.router({
  expectedFailure: publicProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "missing" });
  }),
  unexpectedFailure: publicProcedure.query(() => {
    throw new Error("broken");
  }),
  success: publicProcedure.query(() => "ok"),
});

const caller = router.createCaller({ ip: null, req: undefined, session: null });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withLogging", () => {
  it("logs successful procedures at info", async () => {
    await expect(caller.success()).resolves.toBe("ok");

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "ok", path: "success" }),
      "procedure completed",
    );
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("logs expected caller errors at info", async () => {
    await expect(caller.expectedFailure()).rejects.toThrow("missing");

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND", outcome: "error", path: "expectedFailure" }),
      "procedure completed",
    );
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("logs unexpected server errors at error", async () => {
    await expect(caller.unexpectedFailure()).rejects.toThrow("broken");

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INTERNAL_SERVER_ERROR",
        outcome: "error",
        path: "unexpectedFailure",
      }),
      "procedure completed",
    );
  });
});
