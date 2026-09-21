import { describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";

import { createLogger } from "@domainstack/logger";

import { optionalCall, optionalSettled, requireSettled } from "./settled";

describe("requireSettled", () => {
  it("returns the fulfilled value", () => {
    const result: PromiseSettledResult<string> = { status: "fulfilled", value: "ok" };
    expect(requireSettled(result)).toBe("ok");
  });

  it("re-throws the rejection reason", () => {
    const reason = new Error("dns failed");
    const result: PromiseSettledResult<string> = { status: "rejected", reason };
    expect(() => requireSettled(result)).toThrow(reason);
  });
});

describe("optionalSettled", () => {
  it("returns the fulfilled value", () => {
    const value = { success: true as const, data: { headers: [] } };
    const result: PromiseSettledResult<typeof value> = { status: "fulfilled", value };
    expect(optionalSettled(result)).toEqual(value);
  });

  it("returns null when the step rejected", () => {
    const result: PromiseSettledResult<{ success: true }> = {
      status: "rejected",
      reason: new Error("Headers fetch failed"),
    };
    expect(optionalSettled(result)).toBeNull();
  });
});

describe("optionalCall", () => {
  it("returns the resolved value", async () => {
    await expect(optionalCall(Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("returns null when the promise rejects", async () => {
    await expect(optionalCall(Promise.reject(new Error("geo failed")))).resolves.toBeNull();
  });

  it("returns null without logging for a plain rejection", async () => {
    vi.mocked(createLogger).mockClear();

    await optionalCall(Promise.reject(new Error("transient blip")));

    expect(createLogger).not.toHaveBeenCalled();
  });

  it("logs before returning null when the promise rejects with a FatalError", async () => {
    vi.mocked(createLogger).mockClear();

    const fatal = new FatalError("constraint violation");
    await expect(optionalCall(Promise.reject(fatal))).resolves.toBeNull();

    expect(createLogger).toHaveBeenCalledWith({ source: "workflows/settled" });
    const loggerInstance = vi.mocked(createLogger).mock.results.at(-1)?.value;
    expect(loggerInstance?.error).toHaveBeenCalledWith(
      { err: fatal },
      "optional workflow step failed fatally; continuing without it",
    );
  });

  it("recognizes a FatalError-shaped rejection that lost its prototype (boundary rehydration)", async () => {
    vi.mocked(createLogger).mockClear();

    // A deserialized plain object, not a real Error instance — simulates a
    // step error crossing the SDK's serialization boundary.
    const rehydrated = Object.setPrototypeOf(
      { name: "Error", message: "constraint violation", fatal: true },
      null,
    );

    await expect(optionalCall(Promise.reject(rehydrated))).resolves.toBeNull();
    expect(createLogger).toHaveBeenCalled();
  });

  it("still resolves null even if the logging step itself fails", async () => {
    vi.mocked(createLogger).mockImplementationOnce(() => {
      throw new Error("logger unavailable");
    });

    const fatal = new FatalError("constraint violation");
    await expect(optionalCall(Promise.reject(fatal))).resolves.toBeNull();
  });
});
