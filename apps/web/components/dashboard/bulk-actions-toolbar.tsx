import { ArchiveIcon, TrashIcon, XIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { cn } from "@/lib/utils";

type BulkActionsToolbarProps = {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  onToggleAll: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
  className?: string;
};

export function BulkActionsToolbar({
  selectedCount,
  totalCount,
  isAllSelected,
  isPartiallySelected,
  onToggleAll,
  onArchive,
  onDelete,
  onCancel,
  isArchiving = false,
  isDeleting = false,
  className,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  const isLoading = isArchiving || isDeleting;

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
                onCheckedChange={onToggleAll}
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
            onClick={onArchive}
            disabled={isLoading}
            className="text-[13px]"
          >
            <ArchiveIcon />
            Archive
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="text-[13px]"
          >
            <TrashIcon />
            Delete
          </Button>
        </ButtonGroup>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Cancel selection"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
