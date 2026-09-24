"use client";

import { IconBell, IconUser, IconWallet } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { AccountPanel } from "@/components/settings/account/account-panel";
import { NotificationsPanel } from "@/components/settings/notifications/notifications-panel";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { SubscriptionPanel } from "@/components/settings/subscription/subscription-panel";
import { useRouter } from "@/hooks/use-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@domainstack/ui/tabs";

const SETTINGS_TABS = [
  {
    value: "subscription",
    label: "Subscription",
    icon: IconWallet,
  },
  {
    value: "notifications",
    label: "Notifications",
    icon: IconBell,
  },
  {
    value: "account",
    label: "Account",
    icon: IconUser,
  },
] as const;

type SettingsTabValue = (typeof SETTINGS_TABS)[number]["value"];

function isSettingsTabValue(value: string | null | undefined): value is SettingsTabValue {
  return value === "subscription" || value === "notifications" || value === "account";
}

function SettingsTabsList({ className }: { className?: string }) {
  return (
    <TabsList variant="line" className={className}>
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon;

        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex-initial gap-2 text-[13px] transition-colors hover:text-foreground"
          >
            <Icon className="size-4 !text-inherit" aria-hidden />
            {tab.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

/** The live settings panels; pass as `SettingsTabsRouter` children once data is loaded. */
export function SettingsPanels({ userEmail }: { userEmail: string }) {
  return (
    <>
      <TabsContent value="subscription">
        <SettingsErrorBoundary sectionName="Subscription">
          <SubscriptionPanel />
        </SettingsErrorBoundary>
      </TabsContent>

      <TabsContent value="notifications">
        <SettingsErrorBoundary sectionName="Notifications">
          <NotificationsPanel userEmail={userEmail} />
        </SettingsErrorBoundary>
      </TabsContent>

      <TabsContent value="account">
        <SettingsErrorBoundary sectionName="Account">
          <AccountPanel />
        </SettingsErrorBoundary>
      </TabsContent>
    </>
  );
}

/**
 * Settings tab bar plus tab switching. Panels come in as children: the live
 * `SettingsPanels`, or `SettingsSkeletonPanels` in loading fallbacks, so the
 * real tabs render (and switch) before any settings data has loaded.
 */
export function SettingsTabsRouter({
  navigationMode,
  tabsListPortalId,
  children,
}: {
  navigationMode: "page" | "modal";
  tabsListPortalId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const tabsRootRef = useRef<HTMLDivElement | null>(null);

  // Read the tab from the URL rather than a layout segment, so this works in the
  // settings layout's loading fallback too (above the tab segments). `/settings`
  // itself is rewritten to the first tab.
  const urlTab = pathname.split("/")[2];
  const routeTab: SettingsTabValue = isSettingsTabValue(urlTab) ? urlTab : SETTINGS_TABS[0].value;

  // For the full page variant, we *intentionally* avoid Next.js navigation when switching tabs,
  // because client-side navigation to `/settings/*` would be intercepted and open the modal.
  // Instead, we keep the UI responsive by switching tabs locally and syncing the URL via
  // `history.replaceState` (user confirmed they don't care about Back/Forward here).
  const [pageTab, setPageTab] = useState<SettingsTabValue>(routeTab);

  const activeTab = navigationMode === "page" ? pageTab : routeTab;

  // Look up after commit: a render-time getElementById sees the previous tree,
  // so a same-commit mount (client navigation into the modal) would miss the
  // target and stick with the inline fallback forever.
  const [tabsListPortalTarget, setTabsListPortalTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- sync portal target from committed DOM
    setTabsListPortalTarget(tabsListPortalId ? document.getElementById(tabsListPortalId) : null);
  }, [tabsListPortalId]);

  const scrollPanelsToTop = useCallback((_tab: SettingsTabValue) => {
    // In the modal, settings content is rendered inside our Base UI `ScrollArea` viewport.
    // We scroll that viewport to top so switching tabs always starts at the top.
    const viewport = tabsRootRef.current?.closest(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;

    viewport?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Scroll after the tab switch is committed, so we don't scroll the *previous* panel.
  useLayoutEffect(() => {
    scrollPanelsToTop(activeTab);
  }, [activeTab, scrollPanelsToTop]);

  useEffect(() => {
    if (navigationMode !== "modal") return;

    for (const tab of SETTINGS_TABS) {
      router.prefetch(`/settings/${tab.value}`);
    }
  }, [navigationMode, router]);

  const onValueChange = (nextValue: string) => {
    if (!isSettingsTabValue(nextValue)) return;

    const href = `/settings/${nextValue}`;
    if (navigationMode === "page") {
      setPageTab(nextValue);
      if (window.location.pathname !== href) {
        window.history.replaceState(null, "", href);
      }
      return;
    }

    if (isPending) return;

    startTransition(() => {
      router.replace(href, { scroll: true });
    });
  };

  return (
    <div ref={tabsRootRef}>
      <Tabs value={activeTab} onValueChange={onValueChange}>
        {tabsListPortalTarget ? (
          createPortal(<SettingsTabsList />, tabsListPortalTarget)
        ) : (
          <SettingsTabsList />
        )}
        {children}
      </Tabs>
    </div>
  );
}
