"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SettingsContent } from "@/components/dashboard/settings-content";
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
import { useRouter } from "@/hooks/use-router";
import { signOut, useSession } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    </>
  );
}
