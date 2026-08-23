/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { RegistrationResponse } from "@domainstack/types";

import {
  getDomainToolErrorMessage,
  getDomainToolStatus,
  getTrpcErrorCode,
  type DomainToolResult,
} from "./domain-tools";

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type AssertTrue<T extends true> = T;

type RegistrationSuccess = Exclude<DomainToolResult<"getRegistration">, { error: string }>;
type DnsSuccess = Exclude<DomainToolResult<"getDnsRecords">, { error: string }>;

// Fails if DomainToolResult collapses to `{ error: string }` or includes `data: null`.
type _KeepsRegistrationData = AssertTrue<Equals<RegistrationSuccess, RegistrationResponse>>;
type _ToolsKeepDistinctData = AssertTrue<
  Equals<RegistrationSuccess, DnsSuccess> extends true ? false : true
>;

describe("getDomainToolStatus", () => {
  it("strips the tool- prefix and returns the domain tool label", () => {
    expect(getDomainToolStatus("tool-get_registration")).toBe("Looking up WHOIS data");
  });

  it("returns a readable label for web_search", () => {
    expect(getDomainToolStatus("tool-web_search")).toBe("Searching the web");
  });

  it("falls back to the stripped name for unknown tools", () => {
    expect(getDomainToolStatus("tool-unknown_lookup")).toBe("unknown_lookup");
  });
});

describe("getTrpcErrorCode", () => {
  it("returns a direct tRPC code", () => {
    expect(getTrpcErrorCode({ code: "BAD_REQUEST" })).toBe("BAD_REQUEST");
  });

  it("returns a nested data.code tRPC code", () => {
    expect(getTrpcErrorCode({ data: { code: "TOO_MANY_REQUESTS" } })).toBe("TOO_MANY_REQUESTS");
  });

  it("returns undefined for non-object inputs", () => {
    expect(getTrpcErrorCode("BAD_REQUEST")).toBeUndefined();
    expect(getTrpcErrorCode(null)).toBeUndefined();
  });

  it("ignores generic string codes that are not tRPC codes", () => {
    expect(getTrpcErrorCode({ code: "ENOTFOUND" })).toBeUndefined();
  });
});

describe("getDomainToolErrorMessage", () => {
  it("returns the TOO_MANY_REQUESTS message", () => {
    expect(getDomainToolErrorMessage({ code: "TOO_MANY_REQUESTS" })).toBe(
      "Rate limit exceeded. Please wait a moment and try again.",
    );
  });

  it("returns the BAD_REQUEST message", () => {
    expect(getDomainToolErrorMessage({ data: { code: "BAD_REQUEST" } })).toBe(
      "Please provide a valid root domain (e.g., example.com).",
    );
  });

  it("returns the default message", () => {
    expect(getDomainToolErrorMessage({ code: "INTERNAL_SERVER_ERROR" })).toBe(
      "Unable to fetch data. Please try again.",
    );
    expect(getDomainToolErrorMessage(new Error("boom"))).toBe(
      "Unable to fetch data. Please try again.",
    );
  });
});
