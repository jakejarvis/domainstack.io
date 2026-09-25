import { type Cell, FlexRender } from "@tanstack/react-table";
import { motion } from "motion/react";
import Link from "next/link";

import { LinkPendingIcon } from "@/components/link-pending-icon";
import { useDashboardActions } from "@/context/dashboard-context";
import { useIsDomainSelected } from "@/hooks/use-dashboard-selection";
import { addDomainResumeHref } from "@/lib/add-domain-resume";
import type { DashboardTableFeatures } from "@/lib/dashboard-table-features";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { cn } from "@domainstack/ui/utils";

type DashboardCell = Cell<DashboardTableFeatures, TrackedDomainWithDetails>;

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
  const { onRemove } = useDashboardActions();

  return (
    <td colSpan={colSpan}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Verify ownership to see domain details:
        </span>
        <Button
          size="xs"
          nativeButton={false}
          className="text-[13px]"
          render={
            <Link href={addDomainResumeHref(domain.id, domain.verificationMethod)} scroll={false}>
              <LinkPendingIcon icon={null} />
              Continue
            </Link>
          }
        />
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
 * unverified one keeps cells marked for pending domains and replaces each
 * contiguous run of detail columns with a spanning cell.
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
    const renderedCells: React.ReactNode[] = [];
    let promptRendered = false;
    for (let index = 0; index < cells.length;) {
      const cell = cells[index];
      if (cell.column.columnDef.meta?.showForUnverified) {
        renderedCells.push(<TableCell key={cell.id} cell={cell} />);
        index++;
        continue;
      }

      let end = index + 1;
      while (end < cells.length && !cells[end].column.columnDef.meta?.showForUnverified) end++;
      const colSpan = end - index;
      renderedCells.push(
        promptRendered ? (
          <td key={cell.id} colSpan={colSpan} aria-hidden="true" />
        ) : (
          <VerifyPromptCell key={cell.id} domain={domain} colSpan={colSpan} />
        ),
      );
      promptRendered = true;
      index = end;
    }
    content = renderedCells;
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
