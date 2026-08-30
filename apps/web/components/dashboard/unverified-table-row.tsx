import { type Cell, FlexRender } from "@tanstack/react-table";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

import { useDashboardActions } from "@/context/dashboard-context";
import { useIsDomainSelected } from "@/hooks/use-dashboard-selection";
import type { DashboardTableFeatures } from "@/lib/dashboard-table-features";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const EXPLICIT_COLUMNS = ["select", "domainName", "verified", "actions"];

type UnverifiedTableRowProps = {
  rowId: string;
  cells: Cell<DashboardTableFeatures, TrackedDomainWithDetails, unknown>[];
  original: TrackedDomainWithDetails;
};

export function UnverifiedTableRow({ rowId, cells, original }: UnverifiedTableRowProps) {
  const { onVerify, onRemove, verifyingDomainId } = useDashboardActions();
  const isVerifyPending = verifyingDomainId !== null;
  const isVerifyingThis = verifyingDomainId === original.id;
  const shouldReduceMotion = useReducedMotion();
  const isSelected = useIsDomainSelected(original.id);

  // Find cells by column ID for maintainability
  const cellMap = new Map(cells.map((cell) => [cell.column.id, cell]));
  const selectCell = cellMap.get("select");
  const domainCell = cellMap.get("domainName");
  const statusCell = cellMap.get("verified");
  const actionsCell = cellMap.get("actions");

  // Calculate colspan: total cells minus the 4 we render explicitly
  const collapseCount = cells.length - EXPLICIT_COLUMNS.length;

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
      {/* Checkbox column */}
      {selectCell && (
        <td
          style={{
            width: selectCell.column.getSize(),
          }}
          className={selectCell.column.columnDef.meta?.className}
        >
          <FlexRender cell={selectCell} />
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
          <FlexRender cell={domainCell} />
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
          <FlexRender cell={statusCell} />
        </td>
      )}
      {/* Span remaining detail columns with verify message */}
      <td colSpan={collapseCount}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Verify ownership to see domain details:
          </span>
          <Button
            size="xs"
            onClick={() => onVerify(original.id, original.verificationMethod)}
            disabled={isVerifyPending}
            className="text-[13px]"
          >
            {isVerifyingThis ? <Spinner /> : null}
            Continue
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={() => onRemove(original.id)}
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
          <FlexRender cell={actionsCell} />
        </td>
      )}
    </m.tr>
  );
}
