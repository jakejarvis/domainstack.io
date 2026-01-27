import { Button } from "@domainstack/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@domainstack/ui/collapsible";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { DeleteAccountDialog } from "@/components/settings/account/delete-account-dialog";
import { cn } from "@/lib/utils";

interface DangerZoneCollapsibleProps {
  className?: string;
}

export function DangerZoneCollapsible({
  className,
}: DangerZoneCollapsibleProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <Collapsible
        className={cn("rounded-md border border-destructive/20", className)}
      >
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group flex w-full cursor-pointer items-center justify-between rounded-md bg-destructive/5 px-4 py-3 text-left transition-all hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 data-[panel-open]:rounded-b-none"
            >
              <div className="flex items-center gap-3">
                <IconAlertTriangle className="size-5 text-destructive" />
                <span className="font-medium text-destructive text-sm leading-none">
                  Danger Zone!
                </span>
              </div>
              <IconChevronDown className="size-4 text-destructive/60 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
            </button>
          }
        />
        <CollapsibleContent keepMounted>
          <div className="rounded-b-md bg-destructive/2 p-4">
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
              >
                <IconTrash />
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
