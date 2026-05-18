import type { Href } from "expo-router";

import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

export type DomainstackTab = "domains" | "notifications" | "search";

// Shared so `_layout.tsx`'s stash-and-replay check compares against the same
// literal this module returns instead of a copy-pasted string.
export const NOTIFICATIONS_ROUTE = "/(tabs)/notifications" as const satisfies Href;

const protectedTabs = new Set<DomainstackTab>(["domains", "notifications"]);

function domainDetailRoute(domain: string): Href {
  return { params: { domain }, pathname: "/(tabs)/domains/[domain]" };
}

export function getInitialRoute(isAuthenticated: boolean): Href {
  return isAuthenticated ? "/(tabs)/domains" : "/(tabs)/search";
}

export function canAccessTab(tab: DomainstackTab, isAuthenticated: boolean): boolean {
  return !protectedTabs.has(tab) || isAuthenticated;
}

export function routeFromNotificationData(data: Record<string, unknown>): Href {
  const candidate =
    extractDomainName(data.data) ?? (typeof data.domainName === "string" ? data.domainName : null);

  if (candidate) {
    // A malformed/hostile push payload must never deep-link into a garbage
    // report screen. Normalize then validate; anything that isn't a real
    // domain falls back to the notifications tab.
    const normalized = normalizeDomainInput(candidate);
    if (isValidDomain(normalized)) return domainDetailRoute(normalized);
  }

  return NOTIFICATIONS_ROUTE;
}

function extractDomainName(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { domainName?: unknown }).domainName;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}
