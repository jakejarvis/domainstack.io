import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsSkeleton } from "@/components/settings/settings-skeleton";
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
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<SettingsSkeleton />}>
        <ProtectedSettingsLayout>{children}</ProtectedSettingsLayout>
      </Suspense>
    </div>
  );
}
