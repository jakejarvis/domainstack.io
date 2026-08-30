import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { getServerSession } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  path: "/dashboard",
  title: "Dashboard",
  description: "Manage your tracked domains and notification settings.",
  robots: {
    index: false,
    follow: false,
  },
});

async function ProtectedDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <NuqsAdapter>
        <Suspense fallback={<DashboardSkeleton />}>
          <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
        </Suspense>
      </NuqsAdapter>
    </div>
  );
}
