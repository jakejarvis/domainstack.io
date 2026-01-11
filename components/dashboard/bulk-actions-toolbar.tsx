import { ArchiveIcon, TrashIcon, XIcon } from "@phosphor-icons/react/ssr";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  const isLoading = isArchiving || isDeleting;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl sm:inset-x-auto",
            className,
          )}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/20 bg-background/90 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl dark:border-white/20 dark:bg-background/95"
            role="toolbar"
            aria-label="Bulk actions"
          >
            {/* Left side: Select all + count */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isPartiallySelected}
                  onCheckedChange={onToggleAll}
                  disabled={isLoading}
                  aria-label={
                    isAllSelected ? "Deselect all" : `Select all ${totalCount}`
                  }
                  className="cursor-pointer"
                />
                <Button
                  variant="link"
                  size="sm"
                  onClick={onToggleAll}
                  disabled={isLoading}
                  className="pr-0 pl-0.5 text-sm"
                >
                  Select All ({totalCount})
                </Button>
              </div>

              <Separator orientation="vertical" className="!h-6" />

              <span
                className="font-medium text-sm tabular-nums"
                aria-live="polite"
              >
                {selectedCount} selected
              </span>
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onArchive}
                disabled={isLoading}
              >
                <ArchiveIcon />
                Archive
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isLoading}
              >
                <TrashIcon />
                Delete
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={isLoading}
              >
                <XIcon />
                Cancel
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
