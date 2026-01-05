import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  SettingsPanels,
  SettingsTabsList,
} from "@/components/settings/settings-content";
import {
  SettingsSkeletonPanels,
  SettingsSkeletonTabsList,
} from "@/components/settings/settings-skeleton";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";

function SettingsSkeleton() {
  return (
    <div className="w-full">
      <SettingsSkeletonTabsList className="mb-4" />
      <SettingsSkeletonPanels className="my-2" />
    </div>
  );
}

export default function InterceptedSettingsPage() {
  return (
    <Modal
      title="Settings"
      description="Manage your subscription, notifications, and account preferences."
      showHeader
    >
      <div className="px-6">
        <Suspense fallback={<SettingsSkeleton />}>
          <AuthorizedSettingsContent />
        </Suspense>
      </div>
    </Modal>
  );
}

async function AuthorizedSettingsContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Tabs defaultValue="subscription" className="w-full">
      <SettingsTabsList className="mb-2" />
      <SettingsPanels className="my-2" />
    </Tabs>
  );
}
