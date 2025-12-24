import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StaticBackground } from "@/components/layout/static-background";
import { NotificationsSkeleton } from "@/components/notifications/notifications-skeleton";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Stay updated on changes to your tracked domains.",
  robots: {
    index: false,
    follow: false,
  },
};

async function ProtectedNotificationsLayout({
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

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StaticBackground />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Suspense fallback={<NotificationsSkeleton />}>
          <ProtectedNotificationsLayout>
            {children}
          </ProtectedNotificationsLayout>
        </Suspense>
      </div>
    </>
  );
}
