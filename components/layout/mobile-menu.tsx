"use client";

import { Bookmark, LogIn, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { LoginContent } from "@/components/auth/login-content";
import { BookmarkletDialog } from "@/components/layout/bookmarklet-dialog";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Mobile menu for logged-out users.
 * Contains bookmarklet, theme toggle, and sign in.
 */
export function MobileMenu() {
  const { theme, setTheme, systemTheme } = useTheme();
  const current = theme === "system" ? systemTheme : theme;
  const isDark = current === "dark";

  const [loginOpen, setLoginOpen] = useState(false);
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  // Handle sign in click - open dialog for normal clicks, let link work for modified clicks
  const handleSignInClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    setLoginOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setBookmarkletOpen(true)}
          >
            <Bookmark className="size-4" />
            Bookmarklet
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onSelect={toggleTheme}>
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {isDark ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/login"
              className="cursor-pointer"
              onClick={handleSignInClick}
              data-disable-progress={true}
            >
              <LogIn className="size-4" />
              Sign In
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-black/10 bg-background/80 p-0 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:border-white/10">
          <DialogHeader className="sr-only">
            <DialogTitle>Sign In</DialogTitle>
            <DialogDescription>
              Sign in to track your domains and receive expiration alerts.
            </DialogDescription>
          </DialogHeader>
          <LoginContent showCard={false} />
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
