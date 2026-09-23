import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginSkeletonWithCard } from "@/components/auth/login-skeleton";
import { getServerSession } from "@/lib/auth/session";

async function RedirectAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<LoginSkeletonWithCard />}>
        <RedirectAuthenticatedLayout>{children}</RedirectAuthenticatedLayout>
      </Suspense>
    </div>
  );
}
