"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { DashboardButton } from "@/components/layout/dashboard-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
        <Separator
          aria-hidden="true"
          orientation="vertical"
          className="!h-4 hidden md:block"
        />
        <div className="hidden size-8 animate-pulse rounded-md bg-muted md:flex" />
        {/* Theme toggle button skeleton on desktop */}
        <Separator
          aria-hidden="true"
          orientation="vertical"
          className="!h-4 hidden md:block"
        />
        <div className="hidden size-8 animate-pulse rounded-md bg-muted md:flex" />
      </>
    );
  }

  if (session?.user) {
    return (
      <>
        {/* When signed in: show Dashboard button */}
        <Separator aria-hidden="true" orientation="vertical" className="!h-4" />
        <DashboardButton />
      </>
    );
  }

  return (
    <>
      {/* When signed out: show bookmarklet and theme toggle on desktop */}
      <Separator
        aria-hidden="true"
        orientation="vertical"
        className="!h-4 hidden md:block"
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="hidden cursor-pointer md:flex"
              nativeButton={false}
              render={<Link href="/bookmarklet" scroll={false} />}
            >
              <Bookmark />
              <span className="sr-only">Open bookmarklet info</span>
            </Button>
          }
        />
        <TooltipContent>Bookmarklet</TooltipContent>
      </Tooltip>
      <Separator
        aria-hidden="true"
        orientation="vertical"
        className="!h-4 hidden md:block"
      />
      <ThemeToggle className="hidden md:flex" />
    </>
  );
}
