"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function DangerZoneSettingsSection() {
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <Collapsible open={isDangerZoneOpen} onOpenChange={setIsDangerZoneOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex w-full items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-left transition-all",
              "hover:border-destructive/30 hover:bg-destructive/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2",
              isDangerZoneOpen && "rounded-b-none border-b-0",
            )}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-4 text-destructive" />
              <div>
                <span className="font-medium text-destructive text-sm">
                  Danger Zone
                </span>
                <p className="text-muted-foreground text-xs">
                  Irreversible account actions
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-destructive/60 transition-transform duration-200",
                isDangerZoneOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in">
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
                className="shrink-0 cursor-pointer"
              >
                Delete Account
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
