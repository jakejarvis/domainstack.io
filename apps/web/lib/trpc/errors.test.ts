/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { getTrpcErrorCode, isExpectedTrpcError } from "./errors";

describe("getTrpcErrorCode", () => {
  it("returns a direct tRPC code", () => {
    expect(getTrpcErrorCode({ code: "BAD_REQUEST" })).toBe("BAD_REQUEST");
  });

  it("returns a nested data.code tRPC code", () => {
    expect(getTrpcErrorCode({ data: { code: "TOO_MANY_REQUESTS" } })).toBe("TOO_MANY_REQUESTS");
  });

  it("prefers the direct code over a nested one", () => {
    expect(getTrpcErrorCode({ code: "CONFLICT", data: { code: "NOT_FOUND" } })).toBe("CONFLICT");
  });

  it("returns undefined for non-object inputs", () => {
    expect(getTrpcErrorCode("BAD_REQUEST")).toBeUndefined();
    expect(getTrpcErrorCode(null)).toBeUndefined();
  });

  it("ignores generic string codes that are not tRPC codes", () => {
    expect(getTrpcErrorCode({ code: "ENOTFOUND" })).toBeUndefined();
    expect(getTrpcErrorCode({ code: "ECONNREFUSED" })).toBeUndefined();
  });
});

describe("isExpectedTrpcError", () => {
  it("treats validation and rate-limit failures as expected", () => {
    expect(isExpectedTrpcError({ code: "BAD_REQUEST" })).toBe(true);
    expect(isExpectedTrpcError({ data: { code: "TOO_MANY_REQUESTS" } })).toBe(true);
    expect(isExpectedTrpcError({ code: "NOT_FOUND" })).toBe(true);
  });

  it("treats transient server failures as unexpected so callers retry them", () => {
    // The chat tools and the query client disagreed about these: one reported
    // them to the user as final while the other retried. They retry now.
    for (const code of [
      "INTERNAL_SERVER_ERROR",
      "NOT_IMPLEMENTED",
      "BAD_GATEWAY",
      "SERVICE_UNAVAILABLE",
      "GATEWAY_TIMEOUT",
      "TIMEOUT",
    ]) {
      expect(isExpectedTrpcError({ code })).toBe(false);
    }
  });

  it("treats errors with no tRPC code as unexpected", () => {
    expect(isExpectedTrpcError(new Error("boom"))).toBe(false);
    expect(isExpectedTrpcError({ code: "ECONNREFUSED" })).toBe(false);
  });
});
