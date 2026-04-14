"use client";

import { IconLayoutDashboard, IconLogin, IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import Link from "next/link";

import { AppHeaderSeparator } from "@/components/layout/app-header-separator";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import { Skeleton } from "@domainstack/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";

/**
 * Session-dependent header buttons that conditionally render based on auth state.
 * Client component that uses useSession hook to avoid turning pages into PPR.
 */
export function AppHeaderClientButtons() {
  const { data: session, isPending } = useSession();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  // While loading, show skeleton matching signed-out state (most common on initial load)
  if (isPending) {
    return (
      <>
        <Skeleton className="size-7 max-md:ml-1" />
        <AppHeaderSeparator className="hidden md:block" />
        <Skeleton className="hidden h-7 w-12 md:block" />
      </>
    );
  }

  if (session?.user) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden sm:inline-flex"
                nativeButton={false}
                render={
                  <Link href="/dashboard">
                    <IconLayoutDashboard />
                    <span className="sr-only">Dashboard</span>
                  </Link>
                }
              />
            }
          />
          <TooltipContent>Dashboard</TooltipContent>
        </Tooltip>
        <AppHeaderSeparator className="hidden sm:inline-flex" />
        <NotificationsPopover />
        <AppHeaderSeparator className="mr-2" />
        <UserMenu />
      </>
    );
  }

  // Logged out on mobile: show MobileMenu with hamburger
  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Menu">
              <IconMenu2 />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? <IconSun /> : <IconMoon />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            nativeButton={false}
            render={
              <Link href="/login" scroll={false}>
                <IconLogin />
                Sign In
              </Link>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Logged out on desktop: show theme toggle and Sign In button
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button aria-label="Toggle theme" variant="ghost" size="sm" onClick={toggleTheme}>
              <IconSun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <IconMoon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          }
        />
        <TooltipContent>{theme === "dark" ? "Dark mode" : "Light mode"}</TooltipContent>
      </Tooltip>
      <AppHeaderSeparator />
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={
          <Link href="/login" scroll={false}>
            Sign In
          </Link>
        }
      />
    </>
  );
}
