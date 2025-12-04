"use client";

import { useCallback } from "react";
import { SettingsContent } from "@/components/dashboard/settings-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/hooks/use-router";

export default function SettingsModal() {
  const router = useRouter();

  const handleClose = useCallback(() => {
    // Guard against direct visits with no in-app history
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-3xl border-black/10 bg-background/80 p-0 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:border-white/10">
        <DialogHeader className="sr-only">
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Manage how and when you receive alerts.
          </DialogDescription>
        </DialogHeader>
        <SettingsContent showCard={false} />
      </DialogContent>
    </Dialog>
  );
}
