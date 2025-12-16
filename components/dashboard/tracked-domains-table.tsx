"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
import { useEffect, useMemo, useRef } from "react";
import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { Favicon } from "@/components/domain/favicon";
import { ScreenshotTooltip } from "@/components/domain/screenshot-tooltip";
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
import { useColumnVisibilityPreference } from "@/hooks/use-dashboard-preferences";
import { useTableSortPreference } from "@/hooks/use-dashboard-sort";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTruncation } from "@/hooks/use-truncation";
import type {
  ProviderInfo,
  TrackedDomainWithDetails,
} from "@/lib/db/repos/tracked-domains";
import { formatDateTimeUtc } from "@/lib/format";
import type { ProviderCategory, UserTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type TrackedDomainsTableProps = {
  domains: TrackedDomainWithDetails[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
  tier: UserTier;
  proMaxDomains: number;
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
      {provider.domain && (
        <Favicon
          domain={provider.domain}
          size={13}
          className="shrink-0 rounded"
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
            providerName={provider.name}
            providerDomain={provider.domain}
            providerType={providerType}
            isLoading={tooltipData.isLoading}
            records={tooltipData.records}
            certificateExpiryDate={tooltipData.certificateExpiryDate}
            whoisServer={tooltipData.whoisServer}
            rdapServers={tooltipData.rdapServers}
            registrationSource={tooltipData.registrationSource}
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

export function TrackedDomainsTable({
  domains,
  selectedIds = EMPTY_SET,
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
  tier,
  proMaxDomains,
  onTableReady,
}: TrackedDomainsTableProps) {
  "use no memo"; // Disable React Compiler memoization - TanStack Table has issues with it
  // See: https://github.com/TanStack/table/issues/5567

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { pagination, pageSize, setPageSize, setPageIndex, resetPage } =
    useTablePagination();
  const { sorting, setSorting } = useTableSortPreference({
    onSortChange: resetPage,
  });
  const [columnVisibility, setColumnVisibility] =
    useColumnVisibilityPreference();

  const { showStart, showEnd, update } = useScrollIndicators({
    containerRef: scrollContainerRef,
    direction: "horizontal",
  });

  const columns = useMemo<ColumnDef<TrackedDomainWithDetails>[]>(
    () => [
      // Selection checkbox column
      {
        id: "select",
        header: () => null, // No header checkbox here - it's in the bulk toolbar
        cell: ({ row }) => {
          const isSelected = selectedIds.has(row.original.id);
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
      },
      {
        accessorKey: "domainName",
        header: "Domain",
        cell: ({ row }) => (
          <ScreenshotTooltip domain={row.original.domainName}>
            <Link
              href={`/${encodeURIComponent(row.original.domainName)}`}
              prefetch={false}
              className="group/link flex items-center"
            >
              <span className="font-medium text-[13px] group-hover/link:underline">
                {row.original.domainName}
              </span>
            </Link>
          </ScreenshotTooltip>
        ),
        enableHiding: false, // Always show domain name
        // No size - let it auto-size to content
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
            <VerificationBadge
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
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.expirationDate?.getTime() ?? 0;
          const b = rowB.original.expirationDate?.getTime() ?? 0;
          return a - b;
        },
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
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="cursor-pointer"
                >
                  <MoreVertical />
                  <span className="sr-only">Actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                nativeButton={false}
                render={
                  <a
                    href={`https://${row.original.domainName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer pr-4"
                  >
                    <ExternalLink className="size-3.5" />
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
                    className="cursor-pointer pr-4"
                  >
                    <BookMarked className="size-3.5" />
                    View Report
                  </Link>
                }
              />
              {onArchive && (
                <DropdownMenuItem
                  onClick={() =>
                    onArchive(row.original.id, row.original.domainName)
                  }
                  className="cursor-pointer pr-4"
                >
                  <Archive className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  onRemove(row.original.id, row.original.domainName)
                }
                className="cursor-pointer pr-4"
              >
                <Trash2 className="size-3.5 text-danger-foreground" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 56,
        enableHiding: false, // Always show actions menu
      },
    ],
    [selectedIds, onToggleSelect, onRemove, onArchive, onVerify],
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

  // Re-check gradients when column visibility/data changes (table width can change)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-check when table layout changes (column visibility / row count) even though we only call the updater
  useEffect(() => {
    update();
  }, [columnVisibility, domains.length]);

  return (
    <div className="overflow-hidden rounded-xl border border-black/15 bg-background/60 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/15">
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overscroll-x-none"
        >
          <table
            className="w-full text-[13px]"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {table.getVisibleLeafColumns().map((column) => (
                <col
                  key={column.id}
                  style={
                    column.columnDef.size
                      ? { width: `${column.columnDef.size}px` }
                      : { width: "auto" }
                  }
                />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-black/10 border-b bg-muted/30 dark:border-white/10"
                >
                  {headerGroup.headers.map((header, index) => {
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
                        style={
                          header.column.columnDef.size
                            ? { width: `${header.column.columnDef.size}px` }
                            : undefined
                        }
                        className={cn(
                          "h-9 px-2.5 text-left align-middle font-medium text-muted-foreground text-xs",
                          isDomainColumn && "pl-4",
                          index === headerGroup.headers.length - 1 && "pr-4",
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
                      const collapseCount =
                        cells.length - explicitColumns.length;

                      return (
                        <motion.tr
                          key={row.id}
                          {...rowMotionProps}
                          className={cn(
                            "group transition-colors hover:bg-muted/30",
                            isSelected && "bg-primary/5",
                          )}
                        >
                          {/* Checkbox column */}
                          {selectCell && (
                            <td
                              style={
                                selectCell.column.columnDef.size
                                  ? {
                                      width: `${selectCell.column.columnDef.size}px`,
                                    }
                                  : undefined
                              }
                              className="h-11 pr-2.5 pl-4.5 align-middle"
                            >
                              {flexRender(
                                selectCell.column.columnDef.cell,
                                selectCell.getContext(),
                              )}
                            </td>
                          )}
                          {/* Domain column */}
                          {domainCell && (
                            <td className="h-11 px-2.5 align-middle">
                              {flexRender(
                                domainCell.column.columnDef.cell,
                                domainCell.getContext(),
                              )}
                            </td>
                          )}
                          {/* Status column */}
                          {statusCell && (
                            <td
                              style={
                                statusCell.column.columnDef.size
                                  ? {
                                      width: `${statusCell.column.columnDef.size}px`,
                                    }
                                  : undefined
                              }
                              className="h-11 px-2.5 align-middle"
                            >
                              {flexRender(
                                statusCell.column.columnDef.cell,
                                statusCell.getContext(),
                              )}
                            </td>
                          )}
                          {/* Span remaining detail columns with verify message */}
                          <td
                            colSpan={collapseCount}
                            className="h-11 px-2.5 align-middle"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="mr-2 text-muted-foreground text-xs">
                                Verify ownership to see domain details
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onVerify(row.original)}
                                className="cursor-pointer px-2 text-[13px]"
                              >
                                <Play className="size-3.5 text-accent-green" />
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
                                className="cursor-pointer px-2 text-[13px]"
                              >
                                <Trash2 className="size-3.5 text-danger-foreground" />
                                Remove
                              </Button>
                            </div>
                          </td>
                          {/* Actions column */}
                          {actionsCell && (
                            <td
                              style={{
                                ...(actionsCell.column.columnDef.size
                                  ? {
                                      width: `${actionsCell.column.columnDef.size}px`,
                                    }
                                  : {}),
                              }}
                              className="h-11 px-2.5 pr-4 align-middle"
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
                          "group transition-colors hover:bg-muted/30",
                          isSelected && "bg-primary/5",
                        )}
                      >
                        {cells.map((cell, index) => {
                          return (
                            <td
                              key={cell.id}
                              style={{
                                ...(cell.column.columnDef.size
                                  ? { width: `${cell.column.columnDef.size}px` }
                                  : {}),
                              }}
                              className={cn(
                                "h-11 px-2.5 align-middle",
                                index === 0 && "pl-4.5 text-center",
                                index === cells.length - 1 && "pr-4",
                              )}
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
        </div>

        {/* Left gradient - shown when scrolled right from start */}
        {showStart && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background/60 to-transparent"
          />
        )}

        {/* Right gradient - shown when more content available */}
        {showEnd && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background/60 to-transparent"
          />
        )}
      </div>

      {/* Pagination controls - only show if there are domains */}
      {domains.length > 0 && (
        <TablePagination
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
      {tier === "free" && <UpgradeBanner proMaxDomains={proMaxDomains} />}
    </div>
  );
}
