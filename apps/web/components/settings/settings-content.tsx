"use client";

import { IconBell, IconUser, IconWallet } from "@tabler/icons-react";
import { useSelectedLayoutSegment } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { AccountPanel } from "@/components/settings/account/account-panel";
import { NotificationsPanel } from "@/components/settings/notifications/notifications-panel";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { SubscriptionPanel } from "@/components/settings/subscription/subscription-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/hooks/use-router";

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

function isSettingsTabValue(value: unknown): value is SettingsTabValue {
  return (
    value === "subscription" || value === "notifications" || value === "account"
  );
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
            <Icon className="!text-inherit size-4" aria-hidden />
            {tab.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

function SettingsPanels({ className }: { className?: string }) {
  return (
    <>
      <TabsContent value="subscription" className={className}>
        <SettingsErrorBoundary sectionName="Subscription">
          <SubscriptionPanel />
        </SettingsErrorBoundary>
      </TabsContent>

      <TabsContent value="notifications" className={className}>
        <SettingsErrorBoundary sectionName="Notifications">
          <NotificationsPanel />
        </SettingsErrorBoundary>
      </TabsContent>

      <TabsContent value="account" className={className}>
        <SettingsErrorBoundary sectionName="Account">
          <AccountPanel />
        </SettingsErrorBoundary>
      </TabsContent>
    </>
  );
}

export function SettingsTabsRouter({
  navigationMode,
  tabsListPortalId,
}: {
  navigationMode: "page" | "modal";
  tabsListPortalId?: string;
}) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const [isPending, startTransition] = useTransition();
  const tabsRootRef = useRef<HTMLDivElement | null>(null);

  const segmentTab: SettingsTabValue = isSettingsTabValue(segment)
    ? segment
    : SETTINGS_TABS[0].value;

  // For the full page variant, we *intentionally* avoid Next.js navigation when switching tabs,
  // because client-side navigation to `/settings/*` would be intercepted and open the modal.
  // Instead, we keep the UI responsive by switching tabs locally and syncing the URL via
  // `history.replaceState` (user confirmed they don't care about Back/Forward here).
  const [pageTab, setPageTab] = useState<SettingsTabValue>(segmentTab);

  const activeTab = navigationMode === "page" ? pageTab : segmentTab;

  const [tabsListPortalTarget, setTabsListPortalTarget] =
    useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!tabsListPortalId) {
      setTabsListPortalTarget(null);
      return;
    }

    setTabsListPortalTarget(document.getElementById(tabsListPortalId));
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
    for (const tab of SETTINGS_TABS) {
      const href = `/settings/${tab.value}`;
      router.prefetch(href);
    }
  }, [router]);

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
        <SettingsPanels />
      </Tabs>
    </div>
  );
}
