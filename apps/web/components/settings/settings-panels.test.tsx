import { Component, type ErrorInfo, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";
import type { UserNotificationPreferences } from "@domainstack/types";

import { AccountPanel } from "./account/account-panel";
import { NotificationsPanel } from "./notifications/notifications-panel";
import { SubscriptionPanel } from "./subscription/subscription-panel";

const errors = vi.hoisted(() => ({
  subscription: new Error("boom-subscription"),
  account: new Error("boom-account"),
  notifications: new Error("boom-notifications"),
}));

// Data each mocked hook returns alongside its error. Tests set these to simulate a
// failed background refetch (data present, `isError` true) and reset them afterwards.
const cached = vi.hoisted(() => ({
  subscription: undefined as
    | undefined
    | {
        plan: "free";
        planQuota: number;
        endsAt: null;
        activeCount: number;
        archivedCount: number;
        canAddMore: boolean;
      },
  linkedAccounts: undefined as undefined | unknown[],
  domains: undefined as undefined | unknown[],
  globalPrefs: undefined as undefined | UserNotificationPreferences,
}));

vi.mock("@/hooks/use-subscription", () => ({
  useSubscription: () => ({
    subscription: cached.subscription,
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
    linkedAccounts: cached.linkedAccounts,
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
    domains: cached.domains,
    globalPrefs: cached.globalPrefs,
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
  afterEach(() => {
    cached.subscription = undefined;
    cached.linkedAccounts = undefined;
    cached.domains = undefined;
    cached.globalPrefs = undefined;
  });

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

  it("SubscriptionPanel keeps rendering the plan when a refetch failed", async () => {
    cached.subscription = {
      plan: "free",
      planQuota: 5,
      endsAt: null,
      activeCount: 2,
      archivedCount: 0,
      canAddMore: true,
    };
    const caught: unknown[] = [];
    await render(
      <RecordingBoundary onCatch={(error) => caught.push(error)}>
        <SubscriptionPanel />
      </RecordingBoundary>,
    );
    await expect.element(page.getByText("You're on the Free plan.")).toBeInTheDocument();
    expect(caught).toHaveLength(0);
  });

  it("AccountPanel keeps rendering the providers when a refetch failed", async () => {
    cached.linkedAccounts = [];
    const caught: unknown[] = [];
    await render(
      <RecordingBoundary onCatch={(error) => caught.push(error)}>
        <AccountPanel />
      </RecordingBoundary>,
    );
    await expect.element(page.getByText("Login Providers")).toBeInTheDocument();
    expect(caught).toHaveLength(0);
  });

  it("NotificationsPanel keeps rendering the preferences when a refetch failed", async () => {
    cached.domains = [];
    const toggles = { email: true, inApp: true };
    cached.globalPrefs = {
      providerChanges: toggles,
      domainExpiry: toggles,
      registrationChanges: toggles,
      certificateExpiry: toggles,
      certificateChanges: toggles,
    };
    const caught: unknown[] = [];
    await render(
      <RecordingBoundary onCatch={(error) => caught.push(error)}>
        <NotificationsPanel userEmail="user@example.com" />
      </RecordingBoundary>,
    );
    await expect.element(page.getByText("Global Preferences")).toBeInTheDocument();
    expect(caught).toHaveLength(0);
  });
});
