import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StaticBackground } from "@/components/layout/static-background";
import {
  SettingsSkeletonPanels,
  SettingsSkeletonTabsList,
} from "@/components/settings/settings-skeleton";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your subscription and notification preferences.",
  robots: {
    index: false,
    follow: false,
  },
};

async function ProtectedSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check - requires runtime data (headers)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StaticBackground />
      <div className="container mx-auto px-4 py-8">
        <Suspense
          fallback={
            <div className="space-y-6">
              <div>
                <div className="h-8 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-5 w-80 animate-pulse rounded bg-muted" />
              </div>
              <Card className="overflow-hidden p-0">
                <div className="w-full">
                  <SettingsSkeletonTabsList className="px-6 pt-6 pb-2" />
                  <SettingsSkeletonPanels className="px-6 pt-2 pb-4" />
                </div>
              </Card>
            </div>
          }
        >
          <ProtectedSettingsLayout>{children}</ProtectedSettingsLayout>
        </Suspense>
      </div>
    </>
  );
}
