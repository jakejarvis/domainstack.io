"use client";

import { BookmarkletDialog } from "@/components/layout/bookmarklet-dialog";
import { DashboardButton } from "@/components/layout/dashboard-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth-client";

/**
 * Session-dependent header buttons that conditionally render based on auth state.
 * Client component that uses useSession hook to avoid turning pages into PPR.
 */
export function AppHeaderButtons() {
  const { data: session, isPending } = useSession();

  // While loading, show skeleton matching signed-out state (most common on initial load)
  if (isPending) {
    return (
      <>
        {/* Bookmarklet button skeleton on desktop */}
        <Separator orientation="vertical" className="!h-4 hidden md:block" />
        <div className="hidden h-8 w-[88px] animate-pulse rounded-md bg-muted md:flex" />
        {/* Theme toggle button skeleton on desktop */}
        <Separator orientation="vertical" className="!h-4 hidden md:block" />
        <div className="hidden size-8 animate-pulse rounded-md bg-muted md:flex" />
      </>
    );
  }

  if (session?.user) {
    return (
      <>
        {/* When signed in: show Dashboard button */}
        <Separator orientation="vertical" className="!h-4" />
        <DashboardButton />
      </>
    );
  }

  return (
    <>
      {/* When signed out: show bookmarklet and theme toggle on desktop */}
      <Separator orientation="vertical" className="!h-4 hidden md:block" />
      <BookmarkletDialog className="hidden md:flex" />
      <Separator orientation="vertical" className="!h-4 hidden md:block" />
      <ThemeToggle className="hidden md:flex" />
    </>
  );
}
