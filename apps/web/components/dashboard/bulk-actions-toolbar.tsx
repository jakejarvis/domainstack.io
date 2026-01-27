import { Button } from "@domainstack/ui/button";
import { ButtonGroup } from "@domainstack/ui/button-group";
import { Checkbox } from "@domainstack/ui/checkbox";
import { Label } from "@domainstack/ui/label";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";
import { IconArchive, IconTrash, IconX } from "@tabler/icons-react";
import {
  useDashboardBulkActions,
  useDashboardSelection,
} from "@/context/dashboard-context";

type BulkActionsToolbarProps = {
  /** Total number of domains (for "Select all X" tooltip) */
  totalCount: number;
  className?: string;
};

export function BulkActionsToolbar({
  totalCount,
  className,
}: BulkActionsToolbarProps) {
  const {
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleAll,
    clearSelection,
  } = useDashboardSelection();
  const { onBulkArchive, onBulkDelete, isBulkArchiving, isBulkDeleting } =
    useDashboardBulkActions();

  if (selectedCount === 0) return null;

  const isLoading = isBulkArchiving || isBulkDeleting;

  return (
    <div
      className={cn(
        "fade-in-0 slide-in-from-bottom-4 motion-reduce:slide-in-from-bottom-0 fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg animate-in items-center justify-between gap-4 rounded-xl border border-black/15 bg-background/60 px-4 py-3 shadow-2xl shadow-black/10 backdrop-blur-xl duration-200 sm:inset-x-auto dark:border-white/15",
        className,
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Left: Select all checkbox + count */}
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          render={
            <Label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={isAllSelected}
                indeterminate={isPartiallySelected}
                onCheckedChange={toggleAll}
                disabled={isLoading}
              />
              <span
                className="font-medium text-[13px] tabular-nums"
                aria-live="polite"
              >
                {selectedCount} selected
              </span>
            </Label>
          }
        />
        <ResponsiveTooltipContent>
          {isAllSelected ? "Deselect all" : `Select all ${totalCount} domains`}
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <ButtonGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkArchive}
            disabled={isLoading}
            className="text-[13px]"
          >
            <IconArchive />
            Archive
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            disabled={isLoading}
            className="text-[13px]"
          >
            <IconTrash />
            Delete
          </Button>
        </ButtonGroup>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearSelection}
          disabled={isLoading}
          aria-label="Cancel selection"
        >
          <IconX />
        </Button>
      </div>
    </div>
  );
}
