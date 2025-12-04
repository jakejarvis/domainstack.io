"use client";

import { SettingsContent } from "@/components/dashboard/settings-content";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">Notification Settings</h1>
        <p className="text-muted-foreground">
          Manage how and when you receive alerts.
        </p>
      </div>

      <SettingsContent />
    </div>
  );
}
