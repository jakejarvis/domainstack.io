"use client";

import { Bookmark, LogIn, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { BookmarkletDialog } from "@/components/layout/bookmarklet-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme-toggle";

/**
 * Mobile menu for logged-out users.
 * Contains bookmarklet, theme toggle, and sign in.
 */
export function MobileMenu() {
  const { theme, toggleTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);

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
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Menu"
              className="cursor-pointer"
            >
              <Menu className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setBookmarkletOpen(true)}
          >
            <Bookmark className="size-4" />
            Bookmarklet
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <Link
                href="/login"
                prefetch={false}
                className="cursor-pointer"
                onClick={handleSignInClick}
                data-disable-progress={true}
              >
                <LogIn className="size-4" />
                Sign In
              </Link>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

      {/* Bookmarklet Dialog - controlled externally */}
      <BookmarkletDialog
        open={bookmarkletOpen}
        onOpenChange={setBookmarkletOpen}
      />
    </>
  );
}
