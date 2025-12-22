"use client";

import { Bookmark, LogIn, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);

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
            nativeButton={false}
            render={
              <Link href="/login" scroll={false} className="cursor-pointer">
                <LogIn className="size-4" />
                Sign In
              </Link>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bookmarklet Dialog - controlled externally */}
      <BookmarkletDialog
        open={bookmarkletOpen}
        onOpenChange={setBookmarkletOpen}
      />
    </>
  );
}
