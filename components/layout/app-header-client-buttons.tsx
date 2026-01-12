"use client";

import {
  LayoutIcon,
  ListIcon,
  MoonIcon,
  SignInIcon,
  SunIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AppHeaderSeparator } from "@/components/layout/app-header-separator";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/auth-client";

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
                    <LayoutIcon />
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
              <ListIcon weight="bold" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
            {theme === "dark" ? (
              <SunIcon weight="bold" />
            ) : (
              <MoonIcon weight="bold" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            nativeButton={false}
            render={
              <Link href="/login" scroll={false}>
                <SignInIcon weight="bold" />
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
            <Button
              aria-label="Toggle theme"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
            >
              <SunIcon
                weight="bold"
                className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
              />
              <MoonIcon
                weight="bold"
                className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
              />
              <span className="sr-only">Toggle theme</span>
            </Button>
          }
        />
        <TooltipContent>
          {theme === "dark" ? "Dark mode" : "Light mode"}
        </TooltipContent>
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
