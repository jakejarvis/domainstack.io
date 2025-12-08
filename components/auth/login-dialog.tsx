"use client";

import { LoginContent } from "@/components/auth/login-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Reusable login dialog with consistent styling.
 * Used by AuthButton (desktop) and MobileMenu (mobile).
 */
export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-black/10 bg-background px-0 py-2 dark:border-white/10">
        <DialogHeader className="sr-only">
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Sign in to track your domains and receive health alerts.
          </DialogDescription>
        </DialogHeader>
        <LoginContent showCard={false} onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
