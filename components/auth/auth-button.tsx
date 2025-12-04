"use client";

import Link from "next/link";
import { useState } from "react";
import { LoginContent } from "@/components/auth/login-content";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);

  // While loading, show a placeholder to prevent layout shift
  if (isPending) {
    return (
      <div className="mr-1 ml-2 size-8 animate-pulse rounded-full bg-muted" />
    );
  }

  if (session?.user) {
    return (
      <div className="mr-1 ml-2 h-8">
        <UserMenu />
      </div>
    );
  }

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
        <Link href="/login" onClick={handleClick}>
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
