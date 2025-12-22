"use client";

import { Bell, User, WalletMinimal } from "lucide-react";
import { DangerZoneSettingsSection } from "@/components/settings/danger-zone-settings-section";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";
import { NotificationSettingsSection } from "@/components/settings/notification-settings-section";
import { SubscriptionSettingsSection } from "@/components/settings/subscription-settings-section";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function SettingsTabsList({ className }: { className?: string }) {
  return (
    <TabsList className={cn("h-auto justify-start", className)}>
      <TabsTrigger
        value="subscription"
        className="h-auto flex-col items-center gap-2 px-4 py-2.5"
      >
        <WalletMinimal className="size-[18px]" aria-hidden="true" />
        <span className="text-[13px] leading-none">Subscription</span>
      </TabsTrigger>
      <TabsTrigger
        value="notifications"
        className="h-auto flex-col items-center gap-2 px-4 py-2.5"
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        <span className="text-[13px] leading-none">Notifications</span>
      </TabsTrigger>
      <TabsTrigger
        value="account"
        className="h-auto flex-col items-center gap-2 px-4 py-2.5"
      >
        <User className="size-[18px]" aria-hidden="true" />
        <span className="text-[13px] leading-none">Account</span>
      </TabsTrigger>
    </TabsList>
  );
}

export function SettingsPanels({
  className,
  dividerClassName,
}: {
  className?: string;
  dividerClassName?: string;
}) {
  return (
    <>
      <TabsContent value="subscription" className={className}>
        <SubscriptionSettingsSection />
      </TabsContent>

      <TabsContent value="notifications" className={className}>
        <NotificationSettingsSection dividerClassName={dividerClassName} />
      </TabsContent>

      <TabsContent value="account" className={className}>
        <div className="space-y-6">
          <LinkedAccountsSection />

          {/* Divider */}
          <div className={cn("h-px bg-border/50", dividerClassName)} />

          <DangerZoneSettingsSection />
        </div>
      </TabsContent>
    </>
  );
}

// SettingsContent removed in favor of composable exports
