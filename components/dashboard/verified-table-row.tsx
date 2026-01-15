"use no memo"; // Disable React Compiler memoization - TanStack Table has issues with it

import { type Cell, flexRender } from "@tanstack/react-table";
import { motion } from "motion/react";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";
import { cn } from "@/lib/utils";

type VerifiedTableRowProps = {
  rowId: string;
  cells: Cell<TrackedDomainWithDetails, unknown>[];
  isSelected: boolean;
};

const rowMotionProps = {
  layout: "position" as const,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: {
    duration: 0.16,
    ease: [0.22, 1, 0.36, 1] as const,
  },
};

export function VerifiedTableRow({
  rowId,
  cells,
  isSelected,
}: VerifiedTableRowProps) {
  return (
    <motion.tr
      key={rowId}
      {...rowMotionProps}
      className={cn(
        "group min-w-full transition-colors hover:bg-muted/30",
        isSelected && "bg-primary/5",
        "[&>td]:h-11 [&>td]:pr-2.5 [&>td]:pl-2.5 [&>td]:align-middle",
      )}
    >
      {cells.map((cell) => (
        <td
          key={cell.id}
          style={{
            width: cell.column.getSize(),
          }}
          className={cell.column.columnDef.meta?.className}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </motion.tr>
  );
}
