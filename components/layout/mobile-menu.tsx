"use client";

import { Bookmark, LogIn, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

/**
 * Mobile menu for logged-out users.
 * Contains bookmarklet, theme toggle, and sign in.
 */
export function MobileMenu() {
  const { theme, toggleTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Menu">
            <Menu />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
          {theme === "dark" ? <Sun /> : <Moon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/bookmarklet" scroll={false}>
              <Bookmark />
              Bookmarklet
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/login" scroll={false}>
              <LogIn />
              Sign In
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
