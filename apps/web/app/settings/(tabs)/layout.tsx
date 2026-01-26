import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { Card } from "@/components/ui/card";

export default function SettingsTabsLayout() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your subscription, notifications, and account preferences.
        </p>
      </div>

      <Card className="overflow-hidden border border-black/10 bg-background/80 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 [&_[data-slot=tabs-content]]:mt-2 [&_[data-slot=tabs-content]]:p-2">
        <SettingsTabsRouter navigationMode="page" />
      </Card>
    </div>
  );
}
