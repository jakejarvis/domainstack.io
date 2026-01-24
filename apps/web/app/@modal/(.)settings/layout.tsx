import { GearIcon } from "@phosphor-icons/react/dist/ssr";
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
      <SettingsSkeletonPanels />
    </div>
  );
}

export default function SettingsModalLayout() {
  return (
    <Modal>
      <ModalContent>
        <ModalHeader className="border-b-0 pb-0">
          <ModalTitle className="flex items-center gap-2">
            <GearIcon className="size-5" />
            Settings
          </ModalTitle>
          <ModalDescription>
            Manage your subscription, notifications, and account preferences.
          </ModalDescription>
          <div
            id="settings-modal-tabs"
            className="-mx-5 mt-3 [&_[data-slot=tabs-list]]:px-3.5"
          />
        </ModalHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="min-w-0 p-5 [contain:inline-size]">
            <Suspense fallback={<SettingsSkeleton />}>
              <AuthorizedSettingsModalLayout />
            </Suspense>
          </div>
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
