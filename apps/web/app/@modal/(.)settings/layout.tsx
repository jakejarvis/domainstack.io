import { auth } from "@domainstack/auth/server";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";
import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { SettingsSkeletonPanels } from "@/components/settings/settings-skeleton";

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
          <ModalTitle>Settings</ModalTitle>
          <div
            id="settings-modal-tabs"
            className="-mx-4.5 mt-2 [&_[data-slot=tabs-list]]:px-2"
          />
        </ModalHeader>
        <ScrollArea className="min-h-0 flex-1 bg-popover/10">
          <div className="mt-1 min-w-0 p-5 [contain:inline-size]">
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
