import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { SettingsSkeletonPanels } from "@/components/settings/settings-skeleton";
import { getServerSession } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  path: "/settings",
  title: "Settings",
  description: "Manage your subscription and notification preferences.",
  robots: {
    index: false,
    follow: false,
  },
});

async function ProtectedSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your subscription, notifications, and account preferences.
        </p>
      </div>

      <div className="sm:overflow-hidden sm:rounded-xl sm:border sm:bg-background sm:p-3 sm:shadow-sm [&_[data-slot=tabs-content]]:mt-2 sm:[&_[data-slot=tabs-content]]:p-2">
        <Suspense
          fallback={
            <SettingsTabsRouter navigationMode="page">
              <SettingsSkeletonPanels />
            </SettingsTabsRouter>
          }
        >
          <ProtectedSettingsLayout>{children}</ProtectedSettingsLayout>
        </Suspense>
      </div>
    </div>
  );
}
