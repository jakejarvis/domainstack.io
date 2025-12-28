import { Settings } from "lucide-react";
import {
  SettingsPanels,
  SettingsTabsList,
} from "@/components/settings/settings-content";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 font-semibold text-xl">
          <Settings className="size-5" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription, notifications, and account preferences.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <Tabs defaultValue="subscription" className="w-full">
          <div className="px-6 pt-6">
            <SettingsTabsList />
          </div>

          <SettingsPanels className="px-6 pt-4 pb-6" />
        </Tabs>
      </Card>
    </div>
  );
}
