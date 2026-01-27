"use no memo"; // Disable React Compiler memoization - TanStack Table has issues with it

import { type Cell, flexRender } from "@tanstack/react-table";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useDashboardActions } from "@/context/dashboard-context";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";
import { cn } from "@/lib/utils";

type UnverifiedTableRowProps = {
  rowId: string;
  cells: Cell<TrackedDomainWithDetails, unknown>[];
  original: TrackedDomainWithDetails;
  isSelected: boolean;
};

export function UnverifiedTableRow({
  rowId,
  cells,
  original,
  isSelected,
}: UnverifiedTableRowProps) {
  const { onVerify, onRemove } = useDashboardActions();
  const shouldReduceMotion = useReducedMotion();

  // Find cells by column ID for maintainability
  const cellMap = new Map(cells.map((cell) => [cell.column.id, cell]));
  const selectCell = cellMap.get("select");
  const domainCell = cellMap.get("domainName");
  const statusCell = cellMap.get("verified");
  const actionsCell = cellMap.get("actions");

  // Calculate colspan: total cells minus the 4 we render explicitly
  const explicitColumns = ["select", "domainName", "verified", "actions"];
  const collapseCount = cells.length - explicitColumns.length;

  return (
    <motion.tr
      key={rowId}
      layout={shouldReduceMotion ? false : "position"}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6 }}
      transition={{
        duration: shouldReduceMotion ? 0.1 : 0.16,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      className={cn(
        "group min-w-full transition-colors hover:bg-muted/30",
        isSelected && "bg-primary/5",
        "[&>td]:h-11 [&>td]:pr-2.5 [&>td]:pl-2.5 [&>td]:align-middle",
      )}
    >
      {/* Checkbox column */}
      {selectCell && (
        <td
          style={{
            width: selectCell.column.getSize(),
          }}
          className={selectCell.column.columnDef.meta?.className}
        >
          {flexRender(
            selectCell.column.columnDef.cell,
            selectCell.getContext(),
          )}
        </td>
      )}
      {/* Domain column */}
      {domainCell && (
        <td
          style={{
            width: domainCell.column.getSize(),
          }}
          className={domainCell.column.columnDef.meta?.className}
        >
          {flexRender(
            domainCell.column.columnDef.cell,
            domainCell.getContext(),
          )}
        </td>
      )}
      {/* Status column */}
      {statusCell && (
        <td
          style={{
            width: statusCell.column.getSize(),
          }}
          className={statusCell.column.columnDef.meta?.className}
        >
          {flexRender(
            statusCell.column.columnDef.cell,
            statusCell.getContext(),
          )}
        </td>
      )}
      {/* Span remaining detail columns with verify message */}
      <td colSpan={collapseCount}>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            Verify ownership to see domain details:
          </span>
          <Button
            size="xs"
            onClick={() => onVerify(original.id, original.verificationMethod)}
            className="text-[13px]"
          >
            Continue
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={() => onRemove(original.id, original.domainName)}
            className="text-[13px]"
          >
            Remove
          </Button>
        </div>
      </td>
      {/* Actions column */}
      {actionsCell && (
        <td
          style={{
            width: actionsCell.column.getSize(),
          }}
          className={actionsCell.column.columnDef.meta?.className}
        >
          {flexRender(
            actionsCell.column.columnDef.cell,
            actionsCell.getContext(),
          )}
        </td>
      )}
    </motion.tr>
  );
}
