/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { LookupError } from "@domainstack/core/lookup";

import { getLookupErrorMessage } from "./lookup-errors";

describe("getLookupErrorMessage", () => {
  it("returns a distinct message for a known code", () => {
    expect(getLookupErrorMessage("dns_error")).toContain("could not be resolved");
    expect(getLookupErrorMessage("unsupported_tld")).toContain("TLD");
  });

  it("falls back to the generic message for a code from a newer server", () => {
    const fromNewerServer = "rate_limited" as LookupError;

    expect(getLookupErrorMessage(fromNewerServer)).toBe("Unable to fetch data. Please try again.");
  });
});
