import type { Href } from "expo-router";

export type DomainstackTab = "domains" | "notifications" | "search";

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
  const fromData = extractDomainName(data.data);
  if (fromData) return domainDetailRoute(fromData);

  const topLevelDomain = data.domainName;
  if (typeof topLevelDomain === "string" && topLevelDomain.length > 0) {
    return domainDetailRoute(topLevelDomain);
  }

  return "/(tabs)/notifications";
}

function extractDomainName(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { domainName?: unknown }).domainName;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}
