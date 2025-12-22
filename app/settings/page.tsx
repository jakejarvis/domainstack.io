import {
  SettingsPanels,
  SettingsTabsList,
} from "@/components/settings/settings-content";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your subscription, notifications, and account preferences.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <Tabs defaultValue="subscription" className="w-full">
          <div className="px-6 pt-6">
            <SettingsTabsList />
          </div>

          <SettingsPanels className="px-6 pt-4 pb-6" dividerClassName="-mx-6" />
        </Tabs>
      </Card>
    </div>
  );
}
