"use client";

import { useRouter } from "next/navigation";
import { LoginContent } from "@/components/auth/login-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LoginModal() {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogContent className="max-w-sm rounded-3xl border-black/10 bg-background/80 p-0 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:border-white/10">
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
