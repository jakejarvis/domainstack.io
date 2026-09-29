import { afterEach, describe, expect, it, vi } from "vitest";

import { getBaseUrl } from "./base-url";

describe("getBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NEXT_PUBLIC_BASE_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");
    expect(getBaseUrl()).toBe("https://example.test");
  });

  it("throws when NEXT_PUBLIC_BASE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(() => getBaseUrl()).toThrow("NEXT_PUBLIC_BASE_URL is not set");
  });
});
