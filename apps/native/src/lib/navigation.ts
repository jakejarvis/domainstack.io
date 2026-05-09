export type DomainstackTab = "domains" | "lookup" | "notifications" | "settings";

const protectedTabs = new Set<DomainstackTab>(["domains", "notifications", "settings"]);

export function getInitialRoute(isAuthenticated: boolean): string {
  return isAuthenticated ? "/(tabs)/domains" : "/(tabs)/lookup";
}

export function canAccessTab(tab: DomainstackTab, isAuthenticated: boolean): boolean {
  return !protectedTabs.has(tab) || isAuthenticated;
}

export function routeFromNotificationData(data: Record<string, unknown>): string {
  const trackedDomainId = data.trackedDomainId;
  if (typeof trackedDomainId === "string" && trackedDomainId.length > 0) {
    return `/(tabs)/domains/${trackedDomainId}`;
  }

  const url = data.url;
  if (typeof url === "string" && url.startsWith("domainstack://domains/")) {
    return `/(tabs)/domains/${url.split("/").pop()}`;
  }

  return "/(tabs)/notifications";
}
