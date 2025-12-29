"use client";

import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface DangerZoneSettingsSectionProps {
  className?: string;
}

export function DangerZoneSettingsSection({
  className,
}: DangerZoneSettingsSectionProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <Collapsible className={className}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-left transition-all hover:border-destructive/30 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 data-[panel-open]:rounded-b-none data-[panel-open]:border-b-0"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-destructive" />
                <span className="font-medium text-destructive text-sm leading-none">
                  Danger Zone!
                </span>
              </div>
              <ChevronDown className="size-4 text-destructive/60 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
            </button>
          }
        />
        <CollapsibleContent
          keepMounted
          className={cn(
            "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] duration-200 ease-out",
            "data-[ending-style]:h-0 data-[starting-style]:h-0",
            "data-closed:opacity-0 data-open:opacity-100",
            "[&[hidden]:not([hidden='until-found'])]:hidden",
          )}
        >
          <div className="rounded-b-xl border border-destructive/20 border-t-0 bg-destructive/2 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">Delete account</p>
                <p className="text-muted-foreground text-xs">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="cursor-pointer leading-none"
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}
