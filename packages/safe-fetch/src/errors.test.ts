import { describe, expect, it } from "vitest";
import { SafeFetchError } from "./errors";

describe("SafeFetchError", () => {
  it("has correct name property", () => {
    const error = new SafeFetchError("dns_error", "DNS lookup failed");
    expect(error.name).toBe("SafeFetchError");
  });

  it("stores code and message", () => {
    const error = new SafeFetchError("private_ip", "Resolved to private IP");
    expect(error.code).toBe("private_ip");
    expect(error.message).toBe("Resolved to private IP");
  });

  it("stores optional status", () => {
    const error = new SafeFetchError("invalid_response", "Bad response", 500);
    expect(error.status).toBe(500);
  });

  it("is instanceof Error", () => {
    const error = new SafeFetchError("timeout", "Request timed out");
    expect(error).toBeInstanceOf(Error);
  });
});
