"use client";

import Link from "next/link";
import { useState } from "react";
import { LoginContent } from "@/components/auth/login-content";
import { UserMenu } from "@/components/auth/user-menu";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/lib/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // While loading, show a placeholder to prevent layout shift
  if (isPending) {
    return (
      <div className="mr-1 ml-2 size-8 animate-pulse rounded-full bg-muted" />
    );
  }

  // Logged in: show UserMenu (handles both mobile and desktop)
  if (session?.user) {
    return (
      <div className="mr-1 ml-2 h-8">
        <UserMenu />
      </div>
    );
  }

  // Logged out on mobile: show MobileMenu with hamburger
  if (isMobile) {
    return <MobileMenu />;
  }

  // Logged out on desktop: show Sign In button with dialog

  // Handle click - open dialog for normal clicks, let link work for modified clicks
  const handleClick = (e: React.MouseEvent) => {
    // Allow ctrl+click, cmd+click, middle-click, shift+click to open in new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/login" onClick={handleClick} data-disable-progress={true}>
          Sign In
        </Link>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
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
    </>
  );
}
