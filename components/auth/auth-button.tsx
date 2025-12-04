"use client";

import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();

  // While loading, show a placeholder to prevent layout shift
  if (isPending) {
    return (
      <div className="mr-1 ml-2 size-8 animate-pulse rounded-full bg-muted" />
    );
  }

  if (session?.user) {
    return (
      <div className="mr-1 ml-2 h-8">
        <UserMenu />
      </div>
    );
  }

  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/login">Sign In</Link>
    </Button>
  );
}
