"use client";

import {
  BellSimpleIcon,
  UserIcon,
  WalletIcon,
} from "@phosphor-icons/react/ssr";
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
import { SubscriptionPanel } from "@/components/settings/subscription/subscription-panel";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/hooks/use-router";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  {
    value: "subscription",
    label: "Subscription",
    icon: WalletIcon,
  },
  {
    value: "notifications",
    label: "Notifications",
    icon: BellSimpleIcon,
  },
  {
    value: "account",
    label: "Account",
    icon: UserIcon,
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
    <TabsList className={cn("h-auto justify-start", className)}>
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon;

        return (
          <ResponsiveTooltip key={tab.value}>
            <ResponsiveTooltipTrigger
              render={
                <TabsTrigger
                  value={tab.value}
                  className="h-auto flex-col items-center gap-2 px-4 py-2.5"
                >
                  <Icon className="size-[18px]" weight="bold" aria-hidden />
                  <span className="hidden text-[13px] leading-none sm:inline">
                    {tab.label}
                  </span>
                </TabsTrigger>
              }
            />
            <ResponsiveTooltipContent className="sm:hidden">
              {tab.label}
            </ResponsiveTooltipContent>
          </ResponsiveTooltip>
        );
      })}
    </TabsList>
  );
}

function SettingsPanels({ className }: { className?: string }) {
  return (
    <>
      <TabsContent value="subscription" className={className}>
        <SubscriptionPanel />
      </TabsContent>

      <TabsContent value="notifications" className={className}>
        <NotificationsPanel />
      </TabsContent>

      <TabsContent value="account" className={className}>
        <AccountPanel />
      </TabsContent>
    </>
  );
}

export function SettingsTabsRouter({
  navigationMode,
  className,
  tabsListClassName,
  panelsClassName,
  tabsListPortalId,
}: {
  navigationMode: "page" | "modal";
  className?: string;
  tabsListClassName?: string;
  panelsClassName?: string;
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
      <Tabs
        value={activeTab}
        onValueChange={onValueChange}
        className={cn("w-full", className)}
      >
        {tabsListPortalTarget ? (
          createPortal(
            <SettingsTabsList className={tabsListClassName} />,
            tabsListPortalTarget,
          )
        ) : (
          <SettingsTabsList className={tabsListClassName} />
        )}
        <SettingsPanels className={panelsClassName} />
      </Tabs>
    </div>
  );
}
