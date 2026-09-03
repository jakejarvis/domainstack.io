import { type Cell, FlexRender } from "@tanstack/react-table";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

import { useIsDomainSelected } from "@/hooks/use-dashboard-selection";
import type { DashboardTableFeatures } from "@/lib/dashboard-table-features";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { cn } from "@domainstack/ui/utils";

type VerifiedTableRowProps = {
  rowId: string;
  cells: Cell<DashboardTableFeatures, TrackedDomainWithDetails>[];
  original: TrackedDomainWithDetails;
};

export function VerifiedTableRow({ rowId, cells, original }: VerifiedTableRowProps) {
  const shouldReduceMotion = useReducedMotion();
  const isSelected = useIsDomainSelected(original.id);

  return (
    <m.tr
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
      {cells.map((cell) => (
        <td
          key={cell.id}
          style={{
            width: cell.column.getSize(),
          }}
          className={cell.column.columnDef.meta?.className}
        >
          <FlexRender cell={cell} />
        </td>
      ))}
    </m.tr>
  );
}
