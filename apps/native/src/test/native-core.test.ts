import { describe, expect, it } from "vitest";

import { getEnabledNativeAuthProviders } from "@/lib/auth-providers";
import { reduceAddDomainFlow } from "@/lib/domain-lifecycle";
import { buildGoogleSignInConfig } from "@/lib/google-auth";
import { canAccessTab, getInitialRoute, routeFromNotificationData } from "@/lib/navigation";
import { nonceFromBytes } from "@/lib/nonce";
import {
  type PortfolioDomain,
  filterPortfolioDomains,
  sortPortfolioDomains,
} from "@/lib/portfolio";
import { buildTrpcHeaders } from "@/lib/trpc-headers";

const domains: PortfolioDomain[] = [
  {
    createdAt: "2026-01-01T00:00:00.000Z",
    domainName: "zeta.com",
    expirationDate: "2026-12-01T00:00:00.000Z",
    id: "1",
    muted: false,
    verified: true,
  },
  {
    createdAt: "2026-02-01T00:00:00.000Z",
    domainName: "alpha.com",
    expirationDate: "2026-06-01T00:00:00.000Z",
    id: "2",
    muted: true,
    verified: false,
  },
];

describe("native app core helpers", () => {
  it("filters native auth providers in web parity order", () => {
    expect(
      getEnabledNativeAuthProviders(
        {
          apple: true,
          github: true,
          gitlab: true,
          google: true,
          vercel: true,
        },
        {
          iosClientId: "ios-client",
          webClientId: "web-client",
        },
      ),
    ).toEqual([
      { id: "apple", name: "Apple", supportsNativeIdToken: true },
      { id: "github", name: "GitHub", supportsNativeIdToken: false },
      { id: "gitlab", name: "GitLab", supportsNativeIdToken: false },
      { id: "google", name: "Google", supportsNativeIdToken: true },
      { id: "vercel", name: "Vercel", supportsNativeIdToken: false },
    ]);

    expect(
      getEnabledNativeAuthProviders(
        {
          apple: false,
          github: false,
          gitlab: false,
          google: true,
          vercel: false,
        },
        {
          iosClientId: "",
          webClientId: "",
        },
      ),
    ).toEqual([{ id: "google", name: "Google", supportsNativeIdToken: false }]);
  });

  it("builds Google native sign-in configuration", () => {
    expect(
      getEnabledNativeAuthProviders(
        {
          apple: false,
          github: false,
          gitlab: false,
          google: true,
          vercel: false,
        },
        {
          iosClientId: "",
          webClientId: "web-client",
        },
      ),
    ).toEqual([{ id: "google", name: "Google", supportsNativeIdToken: false }]);

    expect(
      buildGoogleSignInConfig({
        iosClientId: "ios-client",
        webClientId: "web-client",
      }),
    ).toEqual({
      iosClientId: "ios-client",
      scopes: ["email", "profile"],
      webClientId: "web-client",
    });
  });

  it("formats nonce bytes as stable hex", () => {
    expect(nonceFromBytes(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff");
    expect(nonceFromBytes(new Uint8Array(16))).toHaveLength(32);
  });

  it("injects Better Auth cookies into tRPC headers", () => {
    expect(buildTrpcHeaders("better-auth.session_token=abc")).toEqual({
      Cookie: "better-auth.session_token=abc",
      "x-trpc-source": "expo-react-native",
    });

    expect(buildTrpcHeaders(null)).toEqual({
      "x-trpc-source": "expo-react-native",
    });
  });

  it("gates protected tabs by auth state", () => {
    expect(getInitialRoute(true)).toBe("/(tabs)/domains");
    expect(getInitialRoute(false)).toBe("/(tabs)/lookup");
    expect(canAccessTab("lookup", false)).toBe(true);
    expect(canAccessTab("domains", false)).toBe(false);
    expect(canAccessTab("settings", true)).toBe(true);
  });

  it("routes push payloads to domain detail or notifications", () => {
    expect(routeFromNotificationData({ trackedDomainId: "tracked-1" })).toEqual({
      params: { id: "tracked-1" },
      pathname: "/(tabs)/domains/[id]",
    });
    expect(routeFromNotificationData({})).toBe("/(tabs)/notifications");
  });

  it("filters and sorts portfolio domains", () => {
    expect(filterPortfolioDomains(domains, "muted", "")).toHaveLength(1);
    expect(filterPortfolioDomains(domains, "needs-verification", "alpha")).toHaveLength(1);
    expect(sortPortfolioDomains(domains, "name").map((domain) => domain.domainName)).toEqual([
      "alpha.com",
      "zeta.com",
    ]);
    expect(sortPortfolioDomains(domains, "expiry")[0]?.domainName).toBe("alpha.com");
  });

  it("models add and verify domain transitions", () => {
    let state = reduceAddDomainFlow(
      { domain: "", status: "idle" },
      {
        domain: "example.com",
        type: "edit",
      },
    );
    state = reduceAddDomainFlow(state, { type: "submit" });
    state = reduceAddDomainFlow(state, {
      token: "token",
      trackedDomainId: "tracked-1",
      type: "instructions",
    });
    state = reduceAddDomainFlow(state, { type: "verify" });
    state = reduceAddDomainFlow(state, { type: "verified" });

    expect(state).toEqual({
      domain: "example.com",
      status: "verified",
      trackedDomainId: "tracked-1",
    });
  });
});
