"use client";

import { Settings } from "lucide-react";
import { SettingsContent } from "@/components/settings/settings-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollAreaWithIndicators } from "@/components/ui/scroll-area-with-indicators";

interface SettingsDialogProps {
  className?: string;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  className,
  open,
  onOpenChange,
}: SettingsDialogProps) {
  // Controlled mode: open/onOpenChange are provided
  const isControlled = open !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <DialogTrigger className={className} asChild>
          <Button aria-label="Open settings" variant="ghost" size="sm">
            <Settings />
            <span className="sr-only">Open settings</span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden rounded-3xl border-black/10 p-0 dark:border-white/10">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-0 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your subscription, notifications, and account preferences.
          </DialogDescription>
        </DialogHeader>
        <ScrollAreaWithIndicators className="max-h-full px-6 pb-6">
          <SettingsContent showCard={false} />
        </ScrollAreaWithIndicators>
      </DialogContent>
    </Dialog>
  );
}
