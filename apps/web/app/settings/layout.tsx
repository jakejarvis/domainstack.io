import { auth } from "@domainstack/auth/server";
import { Card } from "@domainstack/ui/card";
import { Skeleton } from "@domainstack/ui/skeleton";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StaticBackground } from "@/components/layout/static-background";
import {
  SettingsSkeletonPanels,
  SettingsSkeletonTabsList,
} from "@/components/settings/settings-skeleton";

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
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Suspense
          fallback={
            <div className="space-y-5">
              <div>
                <Skeleton className="h-8 w-28" />
                <Skeleton className="mt-2 h-5 w-80" />
              </div>
              <Card className="overflow-hidden p-3">
                <SettingsSkeletonTabsList />
                <SettingsSkeletonPanels className="mt-2 p-2" />
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
