"use client";

import { BadgeDollarSign, Bell, User } from "lucide-react";
import { DangerZoneSettingsSection } from "@/components/settings/danger-zone-settings-section";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";
import { NotificationSettingsSection } from "@/components/settings/notification-settings-section";
import { SubscriptionSettingsSection } from "@/components/settings/subscription-settings-section";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SettingsContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
}

export function SettingsContent({ showCard = true }: SettingsContentProps) {
  const tabsContent = (
    <Tabs defaultValue="subscription" className="w-full">
      <div className={cn(showCard && "px-6 pt-6")}>
        <TabsList
          className={cn("h-10 w-full justify-start", !showCard && "mb-2")}
        >
          <TabsTrigger
            value="subscription"
            className="cursor-pointer gap-2 data-[state=active]:cursor-default [&_svg]:text-muted-foreground data-[state=active]:[&_svg]:text-foreground"
          >
            <BadgeDollarSign className="size-4" aria-hidden="true" />
            <span className="hidden leading-none lg:inline">Subscription</span>
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="cursor-pointer gap-2 data-[state=active]:cursor-default [&_svg]:text-muted-foreground data-[state=active]:[&_svg]:text-foreground"
          >
            <Bell className="size-4" aria-hidden="true" />
            <span className="hidden leading-none lg:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="cursor-pointer gap-2 data-[state=active]:cursor-default [&_svg]:text-muted-foreground data-[state=active]:[&_svg]:text-foreground"
          >
            <User className="size-4" aria-hidden="true" />
            <span className="hidden leading-none lg:inline">Account</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="subscription"
        className={cn("my-2", showCard && "px-6 pt-2 pb-4")}
      >
        <SubscriptionSettingsSection />
      </TabsContent>

      <TabsContent
        value="notifications"
        className={cn("my-2", showCard && "px-6 pt-2 pb-4")}
      >
        <NotificationSettingsSection />
      </TabsContent>

      <TabsContent
        value="account"
        className={cn("my-2", showCard && "px-6 pt-2 pb-4")}
      >
        <div className="space-y-6">
          <LinkedAccountsSection />

          {/* Divider */}
          <div className={cn("h-px bg-border/50", showCard && "-mx-6")} />

          <DangerZoneSettingsSection />
        </div>
      </TabsContent>
    </Tabs>
  );

  if (!showCard) {
    return tabsContent;
  }

  return <Card className="overflow-hidden p-0">{tabsContent}</Card>;
}
