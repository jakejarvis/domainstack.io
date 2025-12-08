import { SettingsContent } from "@/components/dashboard/settings-content";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your subscription and notification preferences.
        </p>
      </div>

      <SettingsContent />
    </div>
  );
}
