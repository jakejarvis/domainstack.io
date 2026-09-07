import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StaticBackground } from "@/components/layout/static-background";
import { SettingsPageSkeleton } from "@/components/settings/settings-skeleton";
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
    <>
      <StaticBackground />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Suspense fallback={<SettingsPageSkeleton />}>
          <ProtectedSettingsLayout>{children}</ProtectedSettingsLayout>
        </Suspense>
      </div>
    </>
  );
}
