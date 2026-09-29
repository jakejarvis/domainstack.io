import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/modal";
import { prefetchSettingsQueries } from "@/components/settings/prefetch";
import { SettingsPanels, SettingsTabsRouter } from "@/components/settings/settings-content";
import { SettingsSkeletonPanels } from "@/components/settings/settings-skeleton";
import { getServerSession } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo";
import { HydrateClient } from "@/trpc/server";
import { ScrollArea } from "@domainstack/ui/scroll-area";

export const metadata: Metadata = createMetadata({
  path: "/settings",
  title: "Settings",
  description: "Manage your subscription and notification preferences.",
  robots: {
    index: false,
    follow: false,
  },
});

export default function SettingsModalLayout() {
  return (
    <Modal>
      <ModalContent>
        <ModalHeader className="border-b-0 pb-0">
          <ModalTitle>Settings</ModalTitle>
          <div id="settings-modal-tabs" className="-mx-4.5 mt-2 [&_[data-slot=tabs-list]]:px-2" />
        </ModalHeader>
        <ScrollArea className="min-h-0 flex-1 bg-popover/10">
          <div className="mt-1 min-w-0 p-5 [contain:inline-size]">
            <Suspense
              fallback={
                <SettingsTabsRouter navigationMode="modal" tabsListPortalId="settings-modal-tabs">
                  <SettingsSkeletonPanels />
                </SettingsTabsRouter>
              }
            >
              <AuthorizedSettingsModalLayout />
            </Suspense>
          </div>
        </ScrollArea>
      </ModalContent>
    </Modal>
  );
}

async function AuthorizedSettingsModalLayout() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  // Started without awaiting so the modal opens immediately; data streams in with the RSC payload.
  void prefetchSettingsQueries();

  return (
    <HydrateClient>
      <SettingsTabsRouter navigationMode="modal" tabsListPortalId="settings-modal-tabs">
        <SettingsPanels userEmail={session.user.email} />
      </SettingsTabsRouter>
    </HydrateClient>
  );
}
