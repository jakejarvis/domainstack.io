import { afterEach, describe, expect, it, vi } from "vitest";

import { isCronAuthorized } from "@/lib/cron";

function requestWith(authorization?: string) {
  return new Request("https://example.test/api/cron/x", {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

describe("isCronAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the configured bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorized(requestWith("Bearer s3cret"))).toBe(true);
  });

  it("rejects a missing or different secret", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorized(requestWith())).toBe(false);
    expect(isCronAuthorized(requestWith("Bearer nope"))).toBe(false);
    expect(isCronAuthorized(requestWith("Bearer s3cret2"))).toBe(false);
  });

  it("rejects everything when CRON_SECRET is unset or empty", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect(isCronAuthorized(requestWith("Bearer undefined"))).toBe(false);

    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(requestWith("Bearer "))).toBe(false);
    expect(isCronAuthorized(requestWith("Bearer"))).toBe(false);
  });
});
