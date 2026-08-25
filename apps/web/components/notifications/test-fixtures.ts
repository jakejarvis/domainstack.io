import { DASHBOARD_TEST_NOW } from "@/components/dashboard/test-fixtures";
import type { NotificationData } from "@domainstack/types";

export function makeNotification(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    id: "notif-1",
    trackedDomainId: "domain-alpha",
    type: "domain_expiry_7d",
    title: "alpha.com expires in 7 days",
    message: "Renew alpha.com to keep it from expiring.",
    sentAt: DASHBOARD_TEST_NOW,
    readAt: null,
    ...overrides,
  };
}

export function makeNotificationsInfiniteData(items: NotificationData[]) {
  return {
    pages: [{ items, nextCursor: undefined as string | undefined }],
    pageParams: [undefined as string | undefined],
  };
}
