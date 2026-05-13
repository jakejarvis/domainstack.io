import type { Href } from "expo-router";

export type DomainstackTab = "alerts" | "domains" | "search";

const protectedTabs = new Set<DomainstackTab>(["alerts", "domains"]);

function domainDetailRoute(id: string): Href {
  return { params: { id }, pathname: "/(tabs)/domains/[id]" };
}

export function getInitialRoute(isAuthenticated: boolean): Href {
  return isAuthenticated ? "/(tabs)/domains" : "/(tabs)/search";
}

export function canAccessTab(tab: DomainstackTab, isAuthenticated: boolean): boolean {
  return !protectedTabs.has(tab) || isAuthenticated;
}

export function routeFromNotificationData(data: Record<string, unknown>): Href {
  const trackedDomainId = data.trackedDomainId;
  if (typeof trackedDomainId === "string" && trackedDomainId.length > 0) {
    return domainDetailRoute(trackedDomainId);
  }

  const url = data.url;
  if (typeof url === "string" && url.startsWith("domainstack://domains/")) {
    const domainId = url.split("/").pop();
    if (domainId) {
      return domainDetailRoute(domainId);
    }
  }

  return "/(tabs)/alerts";
}
