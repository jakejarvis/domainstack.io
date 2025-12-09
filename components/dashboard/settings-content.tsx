"use client";

import { DangerZoneSettingsSection } from "@/components/dashboard/danger-zone-settings-section";
import { LinkedAccountsSection } from "@/components/dashboard/linked-accounts-section";
import { NotificationSettingsSection } from "@/components/dashboard/notification-settings-section";
import { SubscriptionSettingsSection } from "@/components/dashboard/subscription-settings-section";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
}

export function SettingsContent({ showCard = true }: SettingsContentProps) {
  const content = (
    <div className={cn("space-y-6", showCard ? "px-6" : "py-1")}>
      {/* Subscription Section */}
      <SubscriptionSettingsSection />

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard && "-mx-6")} />

      {/* Email Notifications Section */}
      <NotificationSettingsSection />

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard && "-mx-6")} />

      {/* Linked Accounts Section */}
      <LinkedAccountsSection />

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard && "-mx-6")} />

      {/* Danger Zone Section */}
      <DangerZoneSettingsSection />
    </div>
  );

  if (!showCard) {
    return content;
  }

  return <Card className="overflow-hidden">{content}</Card>;
}
