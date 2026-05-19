import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnabledOAuthProviders } from "./oauth-config";

const ALL_PROVIDER_ENV_VARS = [
  "APPLE_CLIENT_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITLAB_CLIENT_ID",
  "GITLAB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "VERCEL_CLIENT_ID",
  "VERCEL_CLIENT_SECRET",
] as const;

/** Start every case from a known-empty baseline so ambient env can't leak in. */
function clearProviderEnv() {
  for (const key of ALL_PROVIDER_ENV_VARS) vi.stubEnv(key, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getEnabledOAuthProviders", () => {
  it("returns an empty list when nothing is configured", () => {
    clearProviderEnv();
    expect(getEnabledOAuthProviders()).toEqual([]);
  });

  it("returns every provider in Domainstack display order", () => {
    clearProviderEnv();
    vi.stubEnv("APPLE_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    vi.stubEnv("GITLAB_CLIENT_ID", "id");
    vi.stubEnv("GITLAB_CLIENT_SECRET", "secret");
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("VERCEL_CLIENT_ID", "id");
    vi.stubEnv("VERCEL_CLIENT_SECRET", "secret");

    expect(getEnabledOAuthProviders()).toEqual([
      { id: "apple", name: "Apple" },
      { id: "github", name: "GitHub" },
      { id: "gitlab", name: "GitLab" },
      { id: "google", name: "Google" },
      { id: "vercel", name: "Vercel" },
    ]);
  });

  it("treats Apple as enabled on APPLE_CLIENT_ID alone (secret is minted at runtime)", () => {
    clearProviderEnv();
    vi.stubEnv("APPLE_CLIENT_ID", "com.example.app");
    expect(getEnabledOAuthProviders()).toEqual([{ id: "apple", name: "Apple" }]);
  });

  it("keeps display order for a subset and ignores incomplete credential pairs", () => {
    clearProviderEnv();
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    // Only the client id — an incomplete pair must not enable the provider.
    vi.stubEnv("GITHUB_CLIENT_ID", "id");

    expect(getEnabledOAuthProviders()).toEqual([{ id: "google", name: "Google" }]);
  });
});
