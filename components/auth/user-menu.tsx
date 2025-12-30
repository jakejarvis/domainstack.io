"use client";

import { Bookmark, LogOut, Moon, Settings, Sun, Table2 } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "@/hooks/use-router";
import { useTheme } from "@/hooks/use-theme";
import { useAnalytics } from "@/lib/analytics/client";
import { signOut, useSession } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const analytics = useAnalytics();

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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer rounded-full px-0 py-0 hover:bg-transparent active:scale-95 dark:hover:bg-transparent"
            aria-label="User menu"
          >
            <Avatar className="size-8">
              <AvatarImage src={avatarUrl} alt={user.name} size={32} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="flex min-w-56 flex-col overflow-hidden p-0"
      >
        <ScrollArea
          className="h-auto min-h-0 flex-1 py-1"
          gradient
          gradientContext="popover"
        >
          <DropdownMenuLabel className="px-2.5 py-1.5 font-normal">
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarImage src={avatarUrl} alt={user.name} size={32} />
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
              <Link href="/dashboard" className="mx-1 cursor-pointer">
                <Table2 />
                Dashboard
              </Link>
            }
          />
          <DropdownMenuItem
            nativeButton={false}
            render={
              <Link
                href="/settings"
                scroll={false}
                className="mx-1 cursor-pointer"
              >
                <Settings />
                Settings
              </Link>
            }
          />
          <DropdownMenuSeparator />
          {/* Theme toggle and bookmarklet - now visible on all screen sizes */}
          <DropdownMenuItem
            className="mx-1 cursor-pointer"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuItem
            nativeButton={false}
            render={
              <Link
                href="/bookmarklet"
                scroll={false}
                className="mx-1 cursor-pointer"
              >
                <Bookmark />
                Bookmarklet
              </Link>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="mx-1 cursor-pointer"
            onClick={handleSignOut}
          >
            <LogOut className="text-danger-foreground" />
            Sign out
          </DropdownMenuItem>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
