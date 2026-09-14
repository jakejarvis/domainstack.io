import { describe, expect, it } from "vitest";

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
});
