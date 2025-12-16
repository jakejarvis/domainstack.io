"use client";

import { Archive, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
                <button
                  type="button"
                  onClick={onToggleAll}
                  disabled={isLoading}
                  className="cursor-pointer text-sm hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select all ({totalCount})
                </button>
              </div>

              <div className="h-4 w-px bg-border" aria-hidden />

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
                className="cursor-pointer"
              >
                <Archive className="size-3.5" />
                Archive
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <X className="size-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
