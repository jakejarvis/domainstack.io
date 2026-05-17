import { describe, expect, it } from "vitest";

import { buildOAuthProviders } from "./providers";
import type { OAuthCredentials } from "./types";

describe("buildOAuthProviders", () => {
  it("includes only providers with both clientId and clientSecret", () => {
    const { providers, enabledProviders } = buildOAuthProviders({
      github: { clientId: "gh-id", clientSecret: "gh-secret" },
      // Incomplete pair — must be filtered out.
      google: { clientId: "g-id" } as OAuthCredentials,
      gitlab: undefined,
    });

    expect(enabledProviders).toEqual(["github"]);
    expect(providers.github).toEqual({ clientId: "gh-id", clientSecret: "gh-secret" });
    expect(providers.google).toBeUndefined();
  });

  // Regression guard for the Apple live-secret wiring: `server.ts` defines
  // `clientSecret` as a getter that re-signs the Apple JWT on every read.
  // `buildOAuthProviders` must assign credentials by reference — a future
  // `{ ...creds }` spread would snapshot the getter into a stale value and
  // eventually serve an expired secret on a long-lived process.
  it("preserves a live clientSecret getter (does not snapshot via spread)", () => {
    let current = "jwt-1";
    const apple = { clientId: "io.domainstack.app" } as OAuthCredentials;
    Object.defineProperty(apple, "clientSecret", {
      get: () => current,
      enumerable: true,
    });

    const { providers, enabledProviders } = buildOAuthProviders({ apple });

    expect(enabledProviders).toContain("apple");
    expect(providers.apple.clientSecret).toBe("jwt-1");

    // Simulate the background re-sign updating the underlying value.
    current = "jwt-2";
    expect(providers.apple.clientSecret).toBe("jwt-2");

    // The stored config must be the same object reference, not a copy.
    expect(providers.apple).toBe(apple);
  });
});
