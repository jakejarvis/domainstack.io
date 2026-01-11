import { GearIcon } from "@phosphor-icons/react/ssr";
import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { Card } from "@/components/ui/card";

export default function SettingsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 font-semibold text-xl">
          <GearIcon className="size-5" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription, notifications, and account preferences.
        </p>
      </div>

      <Card className="overflow-hidden p-3">
        <SettingsTabsRouter
          navigationMode="page"
          className="space-y-3"
          panelsClassName="p-3"
        />
        {children}
      </Card>
    </div>
  );
}
