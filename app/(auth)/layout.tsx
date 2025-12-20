import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { AnimatedBackground } from "@/components/layout/animated-background";
import { auth } from "@/lib/auth";

async function RedirectAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check - requires runtime data (headers)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <AnimatedBackground />
      <Suspense fallback={<LoginSkeleton />}>
        <RedirectAuthenticatedLayout>{children}</RedirectAuthenticatedLayout>
      </Suspense>
    </div>
  );
}
