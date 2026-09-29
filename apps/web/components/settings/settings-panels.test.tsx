import { Component, type ErrorInfo, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { AccountPanel } from "./account/account-panel";
import { NotificationsPanel } from "./notifications/notifications-panel";
import { SubscriptionPanel } from "./subscription/subscription-panel";

const errors = vi.hoisted(() => ({
  subscription: new Error("boom-subscription"),
  account: new Error("boom-account"),
  notifications: new Error("boom-notifications"),
}));

vi.mock("@/hooks/use-subscription", () => ({
  useSubscription: () => ({
    subscription: undefined,
    isPro: false,
    isSubscriptionLoading: false,
    isSubscriptionError: true,
    subscriptionError: errors.subscription,
    handleCustomerPortal: () => undefined,
    isCustomerPortalLoading: false,
  }),
}));

vi.mock("@/hooks/use-linked-accounts", () => ({
  useLinkedAccounts: () => ({
    linkedAccounts: undefined,
    linkedProviderIds: new Set<string>(),
    enabledProviders: [],
    isLoading: false,
    isError: true,
    error: errors.account,
    canUnlink: false,
    linkProvider: () => Promise.resolve(),
    unlinkProvider: () => undefined,
    isUnlinking: () => false,
    isUnlinkPending: false,
  }),
}));

vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({
    domains: undefined,
    globalPrefs: undefined,
    isLoading: false,
    isError: true,
    error: errors.notifications,
    isPending: false,
    updateGlobalPreference: () => undefined,
    muteDomain: () => undefined,
  }),
}));

vi.mock("@/hooks/use-auth-callback", () => ({
  useAuthCallback: () => undefined,
}));

class RecordingBoundary extends Component<
  { onCatch: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    this.props.onCatch(error);
  }

  render() {
    return this.state.failed ? <p>Boundary caught</p> : this.props.children;
  }
}

async function renderCaught(panel: ReactNode): Promise<unknown[]> {
  const caught: unknown[] = [];
  await render(
    <RecordingBoundary onCatch={(error) => caught.push(error)}>{panel}</RecordingBoundary>,
  );
  await expect.element(page.getByText("Boundary caught")).toBeInTheDocument();
  return caught;
}

describe("settings panels", () => {
  it("SubscriptionPanel throws the original query error to the boundary", async () => {
    const caught = await renderCaught(<SubscriptionPanel />);
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBe(errors.subscription);
  });

  it("AccountPanel throws the original query error to the boundary", async () => {
    const caught = await renderCaught(<AccountPanel />);
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBe(errors.account);
  });

  it("NotificationsPanel throws the original query error to the boundary", async () => {
    const caught = await renderCaught(<NotificationsPanel userEmail="user@example.com" />);
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBe(errors.notifications);
  });
});
