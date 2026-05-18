/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { routeFromNotificationData } from "./navigation";

const domainRoute = (domain: string) => ({
  params: { domain },
  pathname: "/(tabs)/domains/[domain]",
});

// `_layout.tsx` only stashes-and-replays a push when the resolved target is
// exactly `"/(tabs)/notifications"` (a protected route); domain reports are
// public and pushed directly even when signed-out. These tests lock that
// contract so a change to the routing shape can't silently strand a signed-out
// user on a guarded screen — or, conversely, push them to a public report when
// the notification was meant to be replayed after sign-in.
describe("routeFromNotificationData", () => {
  it("routes a nested domain payload to the public domain report", () => {
    expect(routeFromNotificationData({ data: { domainName: "example.com" } })).toEqual(
      domainRoute("example.com"),
    );
  });

  it("routes a top-level domain payload to the public domain report", () => {
    expect(routeFromNotificationData({ domainName: "example.com" })).toEqual(
      domainRoute("example.com"),
    );
  });

  it("prefers the nested domain over a top-level one", () => {
    expect(
      routeFromNotificationData({ data: { domainName: "nested.com" }, domainName: "top.com" }),
    ).toEqual(domainRoute("nested.com"));
  });

  it("falls back to the protected notifications route for non-domain payloads", () => {
    expect(routeFromNotificationData({})).toBe("/(tabs)/notifications");
    expect(routeFromNotificationData({ trackedDomainId: "abc" })).toBe("/(tabs)/notifications");
  });

  it("ignores malformed or empty domain values", () => {
    expect(routeFromNotificationData({ data: { domainName: "" } })).toBe("/(tabs)/notifications");
    expect(routeFromNotificationData({ data: "not-an-object" })).toBe("/(tabs)/notifications");
    expect(routeFromNotificationData({ domainName: 123 })).toBe("/(tabs)/notifications");
  });

  it("rejects hostile/non-domain string payloads instead of deep-linking a garbage report", () => {
    expect(routeFromNotificationData({ domainName: "not a domain!!" })).toBe(
      "/(tabs)/notifications",
    );
    expect(routeFromNotificationData({ domainName: "javascript:alert(1)" })).toBe(
      "/(tabs)/notifications",
    );
    expect(routeFromNotificationData({ data: { domainName: "../../etc/passwd" } })).toBe(
      "/(tabs)/notifications",
    );
  });

  it("normalizes a URL-shaped payload to its bare hostname", () => {
    expect(routeFromNotificationData({ domainName: "https://www.Example.com/path?x=1" })).toEqual(
      domainRoute("example.com"),
    );
  });
});
