"use client";

import Link from "next/link";
import { useState } from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { UserMenu } from "@/components/auth/user-menu";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/lib/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // While loading, show a placeholder to prevent layout shift
  // Mobile: square (hamburger menu or avatar), Desktop: wider (Sign In button or avatar)
  if (isPending) {
    return (
      <div className="mr-1 ml-1 h-8 w-8 animate-pulse rounded-full bg-muted md:w-16 md:rounded-md" />
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
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link
            href="/login"
            prefetch={false}
            onClick={handleClick}
            data-disable-progress={true}
          />
        }
      >
        Sign In
      </Button>

      <LoginDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
