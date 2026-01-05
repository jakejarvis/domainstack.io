import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookMarked,
  ExternalLink,
  MoreVertical,
  Play,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { DashboardTablePagination } from "@/components/dashboard/dashboard-table-pagination";
import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
import { ProviderIcon } from "@/components/icons/provider-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardPagination } from "@/hooks/use-dashboard-pagination";
import { useColumnVisibilityPreference } from "@/hooks/use-dashboard-preferences";
import { useTableSortPreference } from "@/hooks/use-dashboard-sort";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useTruncation } from "@/hooks/use-truncation";
import type {
  ProviderInfo,
  TrackedDomainWithDetails,
} from "@/lib/db/repos/tracked-domains";
import { formatDateTimeUtc } from "@/lib/format";
import type { ProviderCategory } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * Creates a sorting function factory that pushes unverified domains to the end.
 * Returns a function that creates sortingFn functions with access to the current sort state.
 *
 * TanStack Table multiplies the sortingFn result by -1 for descending sorts,
 * so we need to counteract this to keep unverified domains at the end.
 *
 * @param isDescFn - Function that returns whether the current column is sorted descending
 */
function createUnverifiedLastSorter(isDescFn: (columnId: string) => boolean) {
  return function withUnverifiedLast(
    compareFn: (
      a: TrackedDomainWithDetails,
      b: TrackedDomainWithDetails,
    ) => number,
  ) {
    return (
      rowA: { original: TrackedDomainWithDetails },
      rowB: { original: TrackedDomainWithDetails },
      columnId: string,
    ) => {
      const a = rowA.original;
      const b = rowB.original;
      const isDesc = isDescFn(columnId);

      // Push unverified domains to the end regardless of sort direction
      // In desc mode, TanStack multiplies the result by -1, so we counteract it
      if (!a.verified && b.verified) {
        return isDesc ? -1 : 1;
      }
      if (a.verified && !b.verified) {
        return isDesc ? 1 : -1;
      }

      // Both have same verification status, apply the comparison
      return compareFn(a, b);
    };
  };
}

// Define custom column meta for styling
declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: generic needs to match library definition
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

type DashboardTableProps = {
  domains: TrackedDomainWithDetails[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
  onTableReady?: (
    table: ReturnType<typeof useReactTable<TrackedDomainWithDetails>>,
  ) => void;
};

function ProviderCell({
  provider,
  trackedDomainId,
  providerType,
}: {
  provider: ProviderInfo;
  trackedDomainId: string;
  providerType: ProviderCategory;
}) {
  const { valueRef, isTruncated } = useTruncation();

  const tooltipData = useProviderTooltipData({
    provider,
    trackedDomainId,
    providerType,
  });

  if (!provider.name) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const providerContent = (
    <span className="flex min-w-0 items-center gap-1.5">
      {provider.id && (
        <ProviderIcon
          providerId={provider.id}
          providerName={provider.name}
          providerDomain={provider.domain}
          size={13}
          className="shrink-0"
        />
      )}
      <span ref={valueRef} className="min-w-0 flex-1 truncate">
        {provider.name}
      </span>
    </span>
  );

  if (tooltipData.shouldShowTooltip) {
    return (
      <ResponsiveTooltip
        open={tooltipData.isOpen}
        onOpenChange={tooltipData.setIsOpen}
      >
        <ResponsiveTooltipTrigger
          nativeButton={false}
          render={providerContent}
        />
        <ResponsiveTooltipContent>
          <ProviderTooltipContent
            providerId={tooltipData.providerId}
            providerName={provider.name}
            providerDomain={provider.domain}
            providerType={providerType}
            isLoading={tooltipData.isLoading}
            records={tooltipData.records}
            certificateExpiryDate={tooltipData.certificateExpiryDate}
            whoisServer={tooltipData.whoisServer}
            rdapServers={tooltipData.rdapServers}
            registrationSource={tooltipData.registrationSource}
            transferLock={tooltipData.transferLock}
            registrantInfo={tooltipData.registrantInfo}
          />
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
    );
  }

  if (isTruncated) {
    return (
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          nativeButton={false}
          render={providerContent}
        />
        <ResponsiveTooltipContent>{provider.name}</ResponsiveTooltipContent>
      </ResponsiveTooltip>
    );
  }

  return providerContent;
}

function SortIndicator({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") {
    return <ArrowUp className="size-3 shrink-0 text-primary" />;
  }
  if (isSorted === "desc") {
    return <ArrowDown className="size-3 shrink-0 text-primary" />;
  }
  return <ArrowUpDown className="size-3 shrink-0 opacity-50" />;
}

const EMPTY_SET = new Set<string>();

export function DashboardTable({
  domains,
  selectedIds = EMPTY_SET,
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
  onTableReady,
}: DashboardTableProps) {
  "use no memo"; // Disable React Compiler memoization - TanStack Table has issues with it
  // See: https://github.com/TanStack/table/issues/5567

  const { pagination, pageSize, setPageSize, setPageIndex, resetPage } =
    useDashboardPagination();
  const { sorting, setSorting } = useTableSortPreference({
    onSortChange: resetPage,
  });
  const [columnVisibility, setColumnVisibility] =
    useColumnVisibilityPreference();

  // Use refs to store current state so columns can be memoized
  // without being recreated on every selection/sort change
  const sortingRef = useRef(sorting);
  sortingRef.current = sorting;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Create a stable sorting helper that reads from ref instead of closing over state
  // This prevents columns from being recreated on every render
  const withUnverifiedLast = useCallback(
    createUnverifiedLastSorter((columnId) => {
      const columnSort = sortingRef.current.find((s) => s.id === columnId);
      return columnSort?.desc ?? false;
    }),
    [], // Empty deps - reads from ref, not state
  );

  const columns = useMemo<ColumnDef<TrackedDomainWithDetails>[]>(
    () => [
      // Selection checkbox column
      {
        id: "select",
        header: () => null, // No header checkbox here - it's in the bulk toolbar
        cell: ({ row }) => {
          // Read from ref to avoid columns recreation on selection change
          const isSelected = selectedIdsRef.current.has(row.original.id);
          return (
            <div className="relative size-4">
              {/* Favicon - hidden on hover or when selected */}
              <Favicon
                domain={row.original.domainName}
                size={16}
                className={cn(
                  "absolute inset-0",
                  isSelected ? "hidden" : "group-hover:hidden",
                )}
              />
              {/* Checkbox - shown on hover or when selected */}
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(row.original.id)}
                aria-label={`Select ${row.original.domainName}`}
                className={cn(
                  "absolute inset-0 cursor-pointer",
                  isSelected ? "flex" : "hidden group-hover:flex",
                )}
              />
            </div>
          );
        },
        size: 40,
        enableHiding: false, // Always show selection column
        meta: {
          className: "!pl-4.5 max-w-[40px] text-center",
        },
      },
      {
        accessorKey: "domainName",
        header: "Domain",
        cell: ({ row }) => (
          <ScreenshotPopover domain={row.original.domainName}>
            <Link
              href={`/${encodeURIComponent(row.original.domainName)}`}
              prefetch={false}
              className="group/link flex items-center"
              data-disable-progress
            >
              <span className="font-medium text-[13px] group-hover/link:underline">
                {row.original.domainName}
              </span>
            </Link>
          </ScreenshotPopover>
        ),
        enableHiding: false, // Always show domain name
      },
      {
        accessorKey: "verified",
        header: "Status",
        cell: ({ row }) => {
          const isFailing =
            row.original.verified &&
            row.original.verificationStatus === "failing";
          const isPending = !row.original.verified;

          return (
            <DomainStatusBadge
              verified={row.original.verified}
              verificationStatus={row.original.verificationStatus}
              verificationMethod={row.original.verificationMethod}
              verificationFailedAt={row.original.verificationFailedAt}
              onClick={
                isFailing || isPending
                  ? () => onVerify(row.original)
                  : undefined
              }
            />
          );
        },
        size: 100,
        // Sort verified domains first (verified = -1, unverified = 1)
        sortingFn: (rowA, rowB) => {
          return rowA.original.verified === rowB.original.verified
            ? 0
            : rowA.original.verified
              ? -1
              : 1;
        },
      },
      {
        id: "health",
        accessorFn: (row) => row.expirationDate?.getTime() ?? 0,
        header: "Health",
        cell: ({ row }) => (
          <DomainHealthBadge
            expirationDate={row.original.expirationDate}
            verified={row.original.verified}
          />
        ),
        size: 100,
        // Sort by health status priority: critical (0) > warning (1) > healthy (2) > unknown (3)
        // Within the same status, sort by expiration date for more granular ordering
        sortingFn: withUnverifiedLast((a, b) => {
          const now = new Date();
          const getHealthPriority = (
            exp: Date | null,
            verified: boolean,
          ): number => {
            if (!verified || !exp) return 3; // unknown
            const days = Math.floor(
              (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (days <= 7) return 0; // critical
            if (days <= 30) return 1; // warning
            return 2; // healthy
          };

          const aPriority = getHealthPriority(a.expirationDate, a.verified);
          const bPriority = getHealthPriority(b.expirationDate, b.verified);

          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }

          // Same status - sort by expiration date
          const aTime = a.expirationDate?.getTime() ?? 0;
          const bTime = b.expirationDate?.getTime() ?? 0;
          return aTime - bTime;
        }),
      },
      {
        accessorKey: "expirationDate",
        header: "Expires",
        cell: ({ row }) => {
          const date = row.original.expirationDate;
          if (!date) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return (
            <div className="whitespace-nowrap text-[13px]">
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger
                  nativeButton={false}
                  render={<span>{format(date, "MMM d, yyyy")}</span>}
                />
                <ResponsiveTooltipContent>
                  {formatDateTimeUtc(date.toISOString())}
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            </div>
          );
        },
        size: 110,
        sortingFn: withUnverifiedLast((a, b) => {
          const aTime = a.expirationDate?.getTime() ?? 0;
          const bTime = b.expirationDate?.getTime() ?? 0;
          return aTime - bTime;
        }),
      },
      {
        id: "registrar",
        accessorFn: (row) => row.registrar.name ?? "",
        header: "Registrar",
        cell: ({ row }) => (
          <ProviderCell
            provider={row.original.registrar}
            trackedDomainId={row.original.id}
            providerType="registrar"
          />
        ),
        size: 128,
        sortingFn: withUnverifiedLast((a, b) => {
          const aName = a.registrar.name ?? "";
          const bName = b.registrar.name ?? "";
          return aName.localeCompare(bName);
        }),
      },
      {
        id: "dns",
        accessorFn: (row) => row.dns.name ?? "",
        header: "DNS",
        cell: ({ row }) => (
          <ProviderCell
            provider={row.original.dns}
            trackedDomainId={row.original.id}
            providerType="dns"
          />
        ),
        size: 128,
        sortingFn: withUnverifiedLast((a, b) => {
          const aName = a.dns.name ?? "";
          const bName = b.dns.name ?? "";
          return aName.localeCompare(bName);
        }),
      },
      {
        id: "hosting",
        accessorFn: (row) => row.hosting.name ?? "",
        header: "Hosting",
        cell: ({ row }) => (
          <ProviderCell
            provider={row.original.hosting}
            trackedDomainId={row.original.id}
            providerType="hosting"
          />
        ),
        size: 128,
        sortingFn: withUnverifiedLast((a, b) => {
          const aName = a.hosting.name ?? "";
          const bName = b.hosting.name ?? "";
          return aName.localeCompare(bName);
        }),
      },
      {
        id: "email",
        accessorFn: (row) => row.email.name ?? "",
        header: "Email",
        cell: ({ row }) => (
          <ProviderCell
            provider={row.original.email}
            trackedDomainId={row.original.id}
            providerType="email"
          />
        ),
        size: 128,
        sortingFn: withUnverifiedLast((a, b) => {
          const aName = a.email.name ?? "";
          const bName = b.email.name ?? "";
          return aName.localeCompare(bName);
        }),
      },
      {
        id: "ca",
        accessorFn: (row) => row.ca.name ?? "",
        header: "CA",
        cell: ({ row }) => (
          <ProviderCell
            provider={row.original.ca}
            trackedDomainId={row.original.id}
            providerType="ca"
          />
        ),
        size: 128,
        sortingFn: withUnverifiedLast((a, b) => {
          const aName = a.ca.name ?? "";
          const bName = b.ca.name ?? "";
          return aName.localeCompare(bName);
        }),
      },
      {
        accessorKey: "registrationDate",
        header: "Registered",
        cell: ({ row }) => {
          const date = row.original.registrationDate;
          if (!date) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return (
            <div className="whitespace-nowrap text-[13px]">
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger
                  nativeButton={false}
                  render={<span>{format(date, "MMM d, yyyy")}</span>}
                />
                <ResponsiveTooltipContent>
                  {formatDateTimeUtc(date.toISOString())}
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            </div>
          );
        },
        size: 110,
        sortingFn: withUnverifiedLast((a, b) => {
          const aTime = a.registrationDate?.getTime() ?? 0;
          const bTime = b.registrationDate?.getTime() ?? 0;
          return aTime - bTime;
        }),
      },
      {
        accessorKey: "createdAt",
        header: "Added",
        cell: ({ row }) => {
          const date = row.original.createdAt;
          return (
            <div className="whitespace-nowrap text-[13px]">
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger
                  nativeButton={false}
                  render={<span>{format(date, "MMM d, yyyy")}</span>}
                />
                <ResponsiveTooltipContent>
                  {formatDateTimeUtc(date.toISOString())}
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            </div>
          );
        },
        size: 110,
        sortingFn: (rowA, rowB) => {
          return (
            rowA.original.createdAt.getTime() -
            rowB.original.createdAt.getTime()
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-sm">
                  <MoreVertical />
                  <span className="sr-only">Actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem
                nativeButton={false}
                render={
                  <a
                    href={`https://${row.original.domainName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Open
                  </a>
                }
              />
              <DropdownMenuItem
                nativeButton={false}
                render={
                  <Link
                    href={`/${encodeURIComponent(row.original.domainName)}`}
                    prefetch={false}
                  >
                    <BookMarked />
                    View Report
                  </Link>
                }
              />
              <DropdownMenuSeparator />
              {onArchive && (
                <DropdownMenuItem
                  onClick={() =>
                    onArchive(row.original.id, row.original.domainName)
                  }
                  className="cursor-pointer"
                >
                  <Archive />
                  Archive
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem
                  onClick={() =>
                    onRemove(row.original.id, row.original.domainName)
                  }
                  className="cursor-pointer"
                >
                  <Trash2 className="text-danger-foreground" />
                  Remove
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 56,
        enableHiding: false, // Always show actions menu
        meta: {
          className: "!pr-4 text-right",
        },
      },
    ],
    // Note: selectedIds is accessed via ref (selectedIdsRef) to avoid recreating
    // columns on every selection change. The table re-renders cells independently.
    [onToggleSelect, onRemove, onArchive, onVerify, withUnverifiedLast],
  );

  const table = useReactTable({
    data: domains,
    columns,
    state: { sorting, pagination, columnVisibility },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function" ? updater(pagination) : updater;
      setPageIndex(newPagination.pageIndex);
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Expose table instance to parent for column visibility menu in filters bar
  useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  return (
    <div className="overflow-hidden rounded-xl border border-black/15 bg-background/60 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/15">
      <ScrollArea className="w-full">
        <table className="w-full text-[13px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col
                key={column.id}
                style={{
                  width: column.getSize(),
                }}
              />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="min-w-full border-black/10 border-b bg-muted/30 dark:border-white/10"
              >
                {headerGroup.headers.map((header) => {
                  const isSelectColumn = header.column.id === "select";
                  const isDomainColumn = header.column.id === "domainName";

                  // The "Domain" header spans both the selection column (favicon/checkbox)
                  // and the domain name column, so we don't render a separate header cell
                  // for the selection column.
                  if (isSelectColumn) {
                    return null;
                  }

                  const canSort = header.column.getCanSort();
                  // Get sort state directly from our state instead of table API
                  // (header.column.getIsSorted() can return stale values)
                  const sortEntry = sorting.find(
                    (s) => s.id === header.column.id,
                  );
                  const isSorted = sortEntry
                    ? sortEntry.desc
                      ? "desc"
                      : "asc"
                    : false;

                  const headerContent =
                    header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className={cn(
                          "-ml-1.5 inline-flex h-6 cursor-pointer select-none items-center gap-1 rounded px-1.5 text-xs leading-none transition-colors hover:bg-accent hover:text-foreground",
                          isSorted && "text-foreground",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIndicator isSorted={isSorted} />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    );

                  return (
                    <th
                      key={header.id}
                      colSpan={isDomainColumn ? 2 : header.colSpan}
                      style={{
                        width: header.column.getSize(),
                      }}
                      className={cn(
                        "h-9 px-2.5 text-left align-middle font-medium text-muted-foreground text-xs first:pl-4 last:pr-4",
                      )}
                    >
                      {headerContent}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-16 text-center text-muted-foreground text-sm"
                >
                  No domains tracked yet.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {table.getRowModel().rows.map((row) => {
                  const isUnverified = !row.original.verified;
                  const isSelected = selectedIds.has(row.original.id);
                  const cells = row.getVisibleCells();

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

                  // For unverified domains, show simplified row with verify CTA
                  if (isUnverified) {
                    // Find cells by column ID for maintainability
                    const cellMap = new Map(
                      cells.map((cell) => [cell.column.id, cell]),
                    );
                    const selectCell = cellMap.get("select");
                    const domainCell = cellMap.get("domainName");
                    const statusCell = cellMap.get("verified");
                    const actionsCell = cellMap.get("actions");

                    // Calculate colspan: total cells minus the 4 we render explicitly
                    const explicitColumns = [
                      "select",
                      "domainName",
                      "verified",
                      "actions",
                    ];
                    const collapseCount = cells.length - explicitColumns.length;

                    return (
                      <motion.tr
                        key={row.id}
                        {...rowMotionProps}
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
                            className={
                              selectCell.column.columnDef.meta?.className
                            }
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
                            className={
                              domainCell.column.columnDef.meta?.className
                            }
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
                            className={
                              statusCell.column.columnDef.meta?.className
                            }
                          >
                            {flexRender(
                              statusCell.column.columnDef.cell,
                              statusCell.getContext(),
                            )}
                          </td>
                        )}
                        {/* Span remaining detail columns with verify message */}
                        <td colSpan={collapseCount}>
                          <div className="flex items-center gap-2.5">
                            <span className="mr-2 text-muted-foreground text-xs">
                              Verify ownership to see domain details
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onVerify(row.original)}
                              className="px-2 text-[13px]"
                            >
                              <Play className="text-accent-green" />
                              Continue
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onRemove(
                                  row.original.id,
                                  row.original.domainName,
                                )
                              }
                              className="px-2 text-[13px]"
                            >
                              <Trash2 className="text-danger-foreground" />
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
                            className={
                              actionsCell.column.columnDef.meta?.className
                            }
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

                  // Verified domains show full row
                  return (
                    <motion.tr
                      key={row.id}
                      {...rowMotionProps}
                      className={cn(
                        "group min-w-full transition-colors hover:bg-muted/30",
                        isSelected && "bg-primary/5",
                        "[&>td]:h-11 [&>td]:pr-2.5 [&>td]:pl-2.5 [&>td]:align-middle",
                      )}
                    >
                      {cells.map((cell) => {
                        return (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                            }}
                            className={cell.column.columnDef.meta?.className}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        );
                      })}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </ScrollArea>

      {/* Pagination controls - only show if there are domains */}
      {domains.length > 0 && (
        <DashboardTablePagination
          pageIndex={table.getState().pagination.pageIndex}
          pageSize={pageSize}
          pageCount={table.getPageCount()}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPageChange={(index) => setPageIndex(index)}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Upgrade CTA banner for free tier users */}
      {<UpgradeBanner />}
    </div>
  );
}
