import { describe, expect, it } from "vitest";
import { FatalError, RetryableError } from "workflow";
import {
  classifyFetchError,
  getErrorClassification,
  withFetchErrorHandling,
} from "./errors";

// Mock RemoteAssetError
class RemoteAssetError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RemoteAssetError";
  }
}

describe("classifyFetchError", () => {
  describe("DNS errors", () => {
    it("returns FatalError for ENOTFOUND", () => {
      const err = new Error("getaddrinfo ENOTFOUND example.com");
      (err as NodeJS.ErrnoException).code = "ENOTFOUND";
      const result = classifyFetchError(err);
      expect(FatalError.is(result)).toBe(true);
      expect(result.message).toContain("DNS resolution failed");
    });

    it("returns RetryableError for ENODATA (not recognized as DNS error)", () => {
      // ENODATA is not in our DNS error detection, so it's treated as unknown/retryable
      const err = new Error("queryA ENODATA example.com");
      (err as NodeJS.ErrnoException).code = "ENODATA";
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
    });
  });

  describe("RemoteAssetError", () => {
    it("returns FatalError for permanent codes", () => {
      const err = new RemoteAssetError("invalid_url", "Invalid URL");
      const result = classifyFetchError(err);
      expect(FatalError.is(result)).toBe(true);
      expect(result.message).toContain("invalid_url");
    });

    it("returns FatalError for host_blocked", () => {
      const err = new RemoteAssetError("host_blocked", "Host blocked");
      const result = classifyFetchError(err);
      expect(FatalError.is(result)).toBe(true);
    });

    it("returns FatalError for private_ip", () => {
      const err = new RemoteAssetError("private_ip", "Private IP");
      const result = classifyFetchError(err);
      expect(FatalError.is(result)).toBe(true);
    });

    it("returns FatalError for dns_error (domain doesn't resolve)", () => {
      // DNS errors from RemoteAssetError are permanent - the domain doesn't exist
      const err = new RemoteAssetError("dns_error", "DNS lookup failed");
      const result = classifyFetchError(err);
      expect(FatalError.is(result)).toBe(true);
    });

    it("returns RetryableError for invalid_response", () => {
      const err = new RemoteAssetError("invalid_response", "Invalid response");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
    });
  });

  describe("Timeout errors", () => {
    it("returns RetryableError for timeout errors", () => {
      const err = new Error("Request timeout");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
      expect(result.message).toContain("timeout");
    });

    it("returns RetryableError for aborted requests", () => {
      const err = new Error("The operation was aborted");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
    });
  });

  describe("Network errors", () => {
    it("returns RetryableError for ECONNREFUSED", () => {
      const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
      expect(result.message).toContain("network error");
    });

    it("returns RetryableError for ECONNRESET", () => {
      const err = new Error("read ECONNRESET");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
    });

    it("returns RetryableError for socket hang up", () => {
      const err = new Error("socket hang up");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
    });
  });

  describe("Unknown errors", () => {
    it("returns RetryableError for unknown errors by default", () => {
      const err = new Error("Something weird happened");
      const result = classifyFetchError(err);
      expect(RetryableError.is(result)).toBe(true);
    });

    it("returns FatalError for unknown errors when retryUnknown is false", () => {
      const err = new Error("Something weird happened");
      const result = classifyFetchError(err, { retryUnknown: false });
      expect(FatalError.is(result)).toBe(true);
    });
  });

  describe("Options", () => {
    it("includes context in error message", () => {
      const err = new Error("timeout");
      const result = classifyFetchError(err, {
        context: "fetching example.com",
      });
      expect(result.message).toContain("fetching example.com");
    });
  });
});

describe("getErrorClassification", () => {
  it("returns fatal for DNS errors", () => {
    const err = new Error("ENOTFOUND");
    (err as NodeJS.ErrnoException).code = "ENOTFOUND";
    expect(getErrorClassification(err)).toEqual({
      type: "fatal",
      reason: "dns_error",
    });
  });

  it("returns fatal for permanent RemoteAssetErrors", () => {
    const err = new RemoteAssetError("host_blocked", "Host blocked");
    expect(getErrorClassification(err)).toEqual({
      type: "fatal",
      reason: "host_blocked",
    });
  });

  it("returns retryable for network errors", () => {
    const err = new Error("ECONNREFUSED");
    expect(getErrorClassification(err)).toEqual({
      type: "retryable",
      reason: "network",
    });
  });

  it("returns unknown for unrecognized errors", () => {
    const err = new Error("Something else");
    expect(getErrorClassification(err)).toEqual({ type: "unknown" });
  });
});

describe("withFetchErrorHandling", () => {
  it("returns result on success", async () => {
    const result = await withFetchErrorHandling(async () => ({
      data: "success",
    }));
    expect(result).toEqual({ data: "success" });
  });

  it("throws RetryableError for network errors", async () => {
    await expect(
      withFetchErrorHandling(async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).rejects.toThrow(RetryableError);
  });

  it("throws FatalError for permanent errors", async () => {
    await expect(
      withFetchErrorHandling(async () => {
        const err = new Error("ENOTFOUND");
        (err as NodeJS.ErrnoException).code = "ENOTFOUND";
        throw err;
      }),
    ).rejects.toThrow(FatalError);
  });

  it("includes context in error", async () => {
    try {
      await withFetchErrorHandling(
        async () => {
          throw new Error("timeout");
        },
        { context: "test operation" },
      );
    } catch (err) {
      expect((err as Error).message).toContain("test operation");
    }
  });
});
