import { auth } from "@domainstack/auth/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your tracked domains and notification settings.",
  robots: {
    index: false,
    follow: false,
  },
};

async function ProtectedDashboardLayout({
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
