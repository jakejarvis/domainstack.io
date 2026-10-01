import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginContent } from "@/components/auth/login-content";
import { LoginSkeletonWithCard } from "@/components/auth/login-skeleton";
import { getServerSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/safe-next-path";
import { createMetadata } from "@/lib/seo";
import { isKnownAuthErrorCode } from "@domainstack/auth/errors";
import { Card } from "@domainstack/ui/card";

export const metadata: Metadata = createMetadata({
  path: "/login",
  title: "Sign In",
  description: "Sign in to track your domains and receive health alerts.",
});

async function LoginGate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const session = await getServerSession();

  if (session?.user) {
    const { error, next } = await searchParams;

    // A signed-in user landing here with an auth error (e.g. a link flow that lost
    // its state cookie) is sent to account settings, where the error is shown.
    if (typeof error === "string" && isKnownAuthErrorCode(error)) {
      redirect(`/settings/account?error=${encodeURIComponent(error)}`);
    }

    redirect(safeNextPath(typeof next === "string" ? next : null) ?? "/dashboard");
  }

  return (
    <Card className="w-full max-w-md overflow-hidden px-6">
      <LoginContent />
    </Card>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginSkeletonWithCard />}>
      <LoginGate searchParams={searchParams} />
    </Suspense>
  );
}
