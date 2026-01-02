"use client";

import { Bell, User, WalletMinimal } from "lucide-react";
import { DangerZoneSettingsSection } from "@/components/settings/danger-zone-settings-section";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";
import { NotificationSettingsSection } from "@/components/settings/notification-settings-section";
import { SubscriptionSettingsSection } from "@/components/settings/subscription-settings-section";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Separator } from "@/components/ui/separator";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function SettingsTabsList({ className }: { className?: string }) {
  return (
    <TabsList className={cn("h-auto justify-start", className)}>
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          render={
            <TabsTrigger
              value="subscription"
              className="h-auto flex-col items-center gap-2 px-4 py-2.5"
            >
              <WalletMinimal className="size-[18px]" aria-hidden />
              <span className="hidden text-[13px] leading-none sm:inline">
                Subscription
              </span>
            </TabsTrigger>
          }
        />
        <ResponsiveTooltipContent className="sm:hidden">
          Subscription
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>

      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          render={
            <TabsTrigger
              value="notifications"
              className="h-auto flex-col items-center gap-2 px-4 py-2.5"
            >
              <Bell className="size-[18px]" aria-hidden />
              <span className="hidden text-[13px] leading-none sm:inline">
                Notifications
              </span>
            </TabsTrigger>
          }
        />
        <ResponsiveTooltipContent className="sm:hidden">
          Notifications
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>

      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          render={
            <TabsTrigger
              value="account"
              className="h-auto flex-col items-center gap-2 px-4 py-2.5"
            >
              <User className="size-[18px]" aria-hidden />
              <span className="hidden text-[13px] leading-none sm:inline">
                Account
              </span>
            </TabsTrigger>
          }
        />
        <ResponsiveTooltipContent className="sm:hidden">
          Account
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
    </TabsList>
  );
}

export function SettingsPanels({ className }: { className?: string }) {
  return (
    <>
      <TabsContent value="subscription" className={className}>
        <SubscriptionSettingsSection />
      </TabsContent>

      <TabsContent value="notifications" className={className}>
        <NotificationSettingsSection />
      </TabsContent>

      <TabsContent value="account" className={className}>
        <div className="space-y-6">
          <LinkedAccountsSection />

          {/* Divider */}
          <Separator />

          <DangerZoneSettingsSection />
        </div>
      </TabsContent>
    </>
  );
}

// SettingsContent removed in favor of composable exports
