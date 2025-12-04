"use client";

import { useRouter } from "next/navigation";
import { SettingsContent } from "@/components/dashboard/settings-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsModal() {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
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
