import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { SettingsSkeletonPanels } from "@/components/settings/settings-skeleton";
import { Modal } from "@/components/ui/modal";
import { auth } from "@/lib/auth";

function SettingsSkeleton() {
  return (
    <div className="w-full">
      <SettingsSkeletonPanels className="p-5" />
    </div>
  );
}

export default function SettingsModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Modal
      title="Settings"
      description="Manage your subscription, notifications, and account preferences."
      showHeader
      className="pt-1"
      headerSlotId="settings-modal-tabs"
      headerSlotClassName="mt-2"
    >
      <Suspense fallback={<SettingsSkeleton />}>
        <AuthorizedSettingsModalLayout>
          {children}
        </AuthorizedSettingsModalLayout>
      </Suspense>
    </Modal>
  );
}

async function AuthorizedSettingsModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <SettingsTabsRouter
        navigationMode="modal"
        tabsListPortalId="settings-modal-tabs"
        tabsListClassName="h-auto"
        panelsClassName="p-6"
      />
      {children}
    </>
  );
}
