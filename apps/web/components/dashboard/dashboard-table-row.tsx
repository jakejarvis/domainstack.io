import { type Cell, FlexRender } from "@tanstack/react-table";
import { motion } from "motion/react";

import { useDashboardActions } from "@/context/dashboard-context";
import { useIsDomainSelected } from "@/hooks/use-dashboard-selection";
import type { DashboardTableFeatures } from "@/lib/dashboard-table-features";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

type DashboardCell = Cell<DashboardTableFeatures, TrackedDomainWithDetails>;

/** Columns an unverified row still renders; every other visible column collapses into one cell. */
const UNVERIFIED_COLUMNS = new Set(["select", "domainName", "verified", "actions"]);

function TableCell({ cell }: { cell: DashboardCell }) {
  return (
    <td style={{ width: cell.column.getSize() }} className={cell.column.columnDef.meta?.className}>
      <FlexRender cell={cell} />
    </td>
  );
}

function VerifyPromptCell({
  domain,
  colSpan,
}: {
  domain: TrackedDomainWithDetails;
  colSpan: number;
}) {
  const { onVerify, onRemove, verifyingDomainId } = useDashboardActions();

  return (
    <td colSpan={colSpan}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Verify ownership to see domain details:
        </span>
        <Button
          size="xs"
          onClick={() => onVerify(domain.id, domain.verificationMethod)}
          disabled={verifyingDomainId !== null}
          className="text-[13px]"
        >
          {verifyingDomainId === domain.id ? <Spinner /> : null}
          Continue
        </Button>
        <Button
          size="xs"
          variant="destructive"
          onClick={() => onRemove(domain.id)}
          className="text-[13px]"
        >
          Remove
        </Button>
      </div>
    </td>
  );
}

/**
 * One dashboard table row. A verified domain renders every visible cell; an
 * unverified one keeps its select, domain, status, and actions cells and
 * replaces the detail columns with a single verify prompt.
 */
export function DashboardTableRow({
  cells,
  domain,
}: {
  cells: DashboardCell[];
  domain: TrackedDomainWithDetails;
}) {
  const isSelected = useIsDomainSelected(domain.id);

  let content: React.ReactNode;
  if (domain.verified) {
    content = cells.map((cell) => <TableCell key={cell.id} cell={cell} />);
  } else {
    // Hidden columns are already absent from `cells`, so the prompt spans exactly the
    // detail columns that are showing. With none showing it still takes one cell.
    const detailCount = cells.filter((cell) => !UNVERIFIED_COLUMNS.has(cell.column.id)).length;
    const leading = cells.filter(
      (cell) => UNVERIFIED_COLUMNS.has(cell.column.id) && cell.column.id !== "actions",
    );
    const actions = cells.find((cell) => cell.column.id === "actions");

    content = (
      <>
        {leading.map((cell) => (
          <TableCell key={cell.id} cell={cell} />
        ))}
        <VerifyPromptCell domain={domain} colSpan={Math.max(1, detailCount)} />
        {actions ? <TableCell cell={actions} /> : null}
      </>
    );
  }

  return (
    <motion.tr
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{
        duration: 0.16,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      className={cn(
        "group min-w-full transition-colors hover:bg-muted/30",
        isSelected && "bg-primary/5",
        "[&>td]:h-11 [&>td]:pr-2.5 [&>td]:pl-2.5 [&>td]:align-middle",
      )}
    >
      {content}
    </motion.tr>
  );
}
