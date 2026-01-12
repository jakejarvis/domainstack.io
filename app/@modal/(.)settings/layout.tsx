import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { SettingsSkeletonPanels } from "@/components/settings/settings-skeleton";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth } from "@/lib/auth";

function SettingsSkeleton() {
  return (
    <div className="w-full">
      <SettingsSkeletonPanels className="p-5" />
    </div>
  );
}

export default function SettingsModalLayout() {
  return (
    <Modal>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Settings</ModalTitle>
          <ModalDescription>
            Manage your subscription, notifications, and account preferences.
          </ModalDescription>
          <div id="settings-modal-tabs" className="mt-2 min-h-[1px]" />
        </ModalHeader>
        <ScrollArea className="min-h-0 flex-1 p-5">
          <Suspense fallback={<SettingsSkeleton />}>
            <AuthorizedSettingsModalLayout />
          </Suspense>
        </ScrollArea>
      </ModalContent>
    </Modal>
  );
}

async function AuthorizedSettingsModalLayout() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SettingsTabsRouter
      navigationMode="modal"
      tabsListPortalId="settings-modal-tabs"
    />
  );
}
