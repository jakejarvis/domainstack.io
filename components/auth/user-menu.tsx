"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  LogOut,
  Moon,
  Settings,
  Sun,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/hooks/use-router";
import { useTheme } from "@/hooks/use-theme";
import { useAnalytics } from "@/lib/analytics/client";
import { signOut, useSession } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const analytics = useAnalytics();
  const trpc = useTRPC();

  // Get unread notification count
  const { data: unreadCount = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    enabled: !!session?.user,
  });

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const avatarUrl = `/api/avatar/${user.id}`;
  const initials =
    (user.name || "")
      .split(" ")
      .filter((n) => n.length > 0)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const handleSignOut = async () => {
    analytics.track("sign_out_clicked");
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            // Reset PostHog identity to prevent event crossover between users
            analytics.reset();
            router.push("/");
          },
        },
      });
    } catch (err) {
      logger.error("Sign-out failed", err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="cursor-pointer rounded-full ring-offset-background transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
            aria-label="User menu"
          >
            <Avatar className="size-8">
              <AvatarImage src={avatarUrl} alt={user.name || "User avatar"} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarImage src={avatarUrl} alt={user.name || "User avatar"} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1">
              <p className="font-medium text-sm leading-none">
                {user.name || "User"}
              </p>
              <p className="text-muted-foreground text-xs leading-none">
                {user.email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/dashboard" className="cursor-pointer">
              <Table2 className="size-4" />
              Dashboard
            </Link>
          }
        />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/notifications" className="cursor-pointer">
              <Bell className="size-4" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {unreadCount}
                </Badge>
              )}
            </Link>
          }
        />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/settings" scroll={false} className="cursor-pointer">
              <Settings className="size-4" />
              Settings
            </Link>
          }
        />
        <DropdownMenuSeparator />
        {/* Theme toggle and bookmarklet - now visible on all screen sizes */}
        <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/bookmarklet" scroll={false} className="cursor-pointer">
              <Bookmark className="size-4" />
              Bookmarklet
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
          <LogOut className="size-4 text-danger-foreground" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
