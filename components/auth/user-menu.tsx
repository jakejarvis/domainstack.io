"use client";

import { Bookmark, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { SettingsContent } from "@/components/dashboard/settings-content";
import { BookmarkletDialog } from "@/components/layout/bookmarklet-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/hooks/use-router";
import { signOut, useSession } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { theme, setTheme, systemTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);

  const current = theme === "system" ? systemTheme : theme;
  const isDark = current === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/");
          },
        },
      });
    } catch (err) {
      logger.error("Sign-out failed", err);
    }
  };

  // Handle settings click - open dialog for normal clicks, let link work for modified clicks
  const handleSettingsClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    setSettingsOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full ring-offset-background transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
            aria-label="User menu"
          >
            <Avatar className="size-8">
              <AvatarImage src={user.image || undefined} alt={user.name} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="font-medium text-sm leading-none">{user.name}</p>
              <p className="text-muted-foreground text-xs leading-none">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Mobile-only items: bookmarklet and theme toggle */}
          {isMobile && (
            <>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => setBookmarkletOpen(true)}
              >
                <Bookmark className="size-4" />
                Bookmarklet
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={toggleTheme}
              >
                {isDark ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
                {isDark ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="cursor-pointer">
              <User className="size-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/dashboard/settings"
              className="cursor-pointer"
              onClick={handleSettingsClick}
              data-disable-progress={true}
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-black/10 bg-background/80 p-0 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:border-white/10">
          <DialogHeader className="sr-only">
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>
              Manage how and when you receive alerts.
            </DialogDescription>
          </DialogHeader>
          <SettingsContent showCard={false} />
        </DialogContent>
      </Dialog>

      {/* Bookmarklet Dialog - controlled externally */}
      <BookmarkletDialog
        open={bookmarkletOpen}
        onOpenChange={setBookmarkletOpen}
      />
    </>
  );
}
