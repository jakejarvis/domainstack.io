"use client";

import { useCallback } from "react";
import { LoginContent } from "@/components/auth/login-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/hooks/use-router";

export default function LoginModal() {
  const router = useRouter();

  const handleClose = useCallback(() => {
    // Guard against direct visits with no in-app history
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <Dialog open onOpenChange={handleClose}>
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
  );
}
