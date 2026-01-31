import { auth } from "@domainstack/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginSkeletonWithCard } from "@/components/auth/login-skeleton";
import { AnimatedBackground } from "@/components/layout/animated-background";

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
    <>
      <AnimatedBackground />
      <div className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={<LoginSkeletonWithCard />}>
          <RedirectAuthenticatedLayout>{children}</RedirectAuthenticatedLayout>
        </Suspense>
      </div>
    </>
  );
}
