import { IconArchive, IconBell, IconBellOff, IconTrash, IconX } from "@tabler/icons-react";

import { useDashboardBulkActions } from "@/context/dashboard-context";
import { useDashboardSelection } from "@/hooks/use-dashboard-selection";
import { Button } from "@domainstack/ui/button";
import { ButtonGroup } from "@domainstack/ui/button-group";
import { Checkbox } from "@domainstack/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import { Field, FieldLabel } from "@domainstack/ui/field";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

type BulkActionsToolbarProps = {
  /** Total number of domains (for "Select all X" tooltip) */
  totalCount: number;
  className?: string;
};

export function BulkActionsToolbar({ totalCount, className }: BulkActionsToolbarProps) {
  const {
    selectedIds,
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleAll,
    clearSelection,
  } = useDashboardSelection();
  const { onBulkArchive, onBulkDelete, onBulkMute, isBulkArchiving, isBulkDeleting, isBulkMuting } =
    useDashboardBulkActions();

  const handleBulkArchive = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) onBulkArchive(ids);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) onBulkDelete(ids);
  };

  const handleBulkMute = (muted: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) onBulkMute(ids, muted);
  };

  if (selectedCount === 0) return null;

  const isLoading = isBulkArchiving || isBulkDeleting || isBulkMuting;

  return (
    <div
      className={cn(
        "fixed inset-x-4 z-50 mx-auto flex max-w-2xl animate-in items-center justify-between gap-2 rounded-xl border border-black/15 bg-background/60 px-4 py-3 shadow-2xl shadow-black/10 backdrop-blur-xl duration-200 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-x-auto sm:gap-4 dark:border-white/15",
        "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Left: Select all checkbox + count */}
      <Field className="w-auto min-w-0">
        <ResponsiveTooltip>
          <ResponsiveTooltipTrigger
            nativeButton={false}
            render={
              <FieldLabel className="flex min-w-0 cursor-pointer items-center gap-2.5 select-none">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isPartiallySelected}
                  onCheckedChange={toggleAll}
                  disabled={isLoading}
                  aria-label={isAllSelected ? "Deselect all" : `Select all ${totalCount} domains`}
                />
                <span className="truncate text-[13px] font-medium tabular-nums" aria-live="polite">
                  {selectedCount} selected
                </span>
              </FieldLabel>
            }
          />
          <ResponsiveTooltipContent>
            {isAllSelected ? "Deselect all" : `Select all ${totalCount} domains`}
          </ResponsiveTooltipContent>
        </ResponsiveTooltip>
      </Field>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-11 text-[13px]">
                  {isLoading ? <Spinner /> : null}
                  Actions…
                </Button>
              }
            />
            <DropdownMenuContent align="end" side="top" className="min-w-40">
              <DropdownMenuItem
                onClick={() => handleBulkMute(true)}
                disabled={isLoading}
                className="min-h-11"
              >
                <IconBellOff aria-hidden />
                Mute
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkMute(false)}
                disabled={isLoading}
                className="min-h-11"
              >
                <IconBell aria-hidden />
                Unmute
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleBulkArchive}
                disabled={isLoading}
                className="min-h-11"
              >
                <IconArchive aria-hidden />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleBulkDelete}
                disabled={isLoading}
                variant="destructive"
                className="min-h-11"
              >
                <IconTrash aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMute(true)}
              disabled={isLoading}
              className="text-[13px]"
            >
              {isBulkMuting ? <Spinner /> : <IconBellOff aria-hidden />}
              Mute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMute(false)}
              disabled={isLoading}
              className="text-[13px]"
            >
              {isBulkMuting ? <Spinner /> : <IconBell aria-hidden />}
              Unmute
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkArchive}
              disabled={isLoading}
              className="text-[13px]"
            >
              {isBulkArchiving ? <Spinner /> : <IconArchive aria-hidden />}
              Archive
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isLoading}
              className="text-[13px]"
            >
              {isBulkDeleting ? <Spinner /> : <IconTrash aria-hidden />}
              Delete
            </Button>
          </ButtonGroup>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearSelection}
          disabled={isLoading}
          className="size-11 sm:size-8"
          aria-label="Cancel selection"
        >
          <IconX aria-hidden />
        </Button>
      </div>
    </div>
  );
}
