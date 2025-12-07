"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { Favicon } from "@/components/domain/favicon";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type PageSize,
  usePageSizePreference,
} from "@/hooks/use-page-size-preference";
import type {
  ProviderInfo,
  TrackedDomainWithDetails,
} from "@/lib/db/repos/tracked-domains";
import { formatDateTimeUtc } from "@/lib/format";
import type { UserTier } from "@/lib/schemas";
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
};

function ProviderCell({ provider }: { provider: ProviderInfo }) {
  if (!provider.name) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {provider.domain && (
        <Favicon domain={provider.domain} size={13} className="shrink-0" />
      )}
      <span className="truncate text-[13px]">{provider.name}</span>
    </div>
  );
}

function SortIndicator({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") {
    return <ArrowUp className="size-3 text-primary" />;
  }
  if (isSorted === "desc") {
    return <ArrowDown className="size-3 text-primary" />;
  }
  return <ArrowUpDown className="size-3 opacity-50" />;
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
}: TrackedDomainsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageSize, setPageSize] = usePageSizePreference();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const columns = useMemo<ColumnDef<TrackedDomainWithDetails>[]>(
    () => [
      // Selection checkbox column
      {
        id: "select",
        header: () => null, // No header checkbox here - it's in the bulk toolbar
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => onToggleSelect?.(row.original.id)}
            aria-label={`Select ${row.original.domainName}`}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "domainName",
        header: "Domain",
        cell: ({ row }) => (
          <ScreenshotTooltip domain={row.original.domainName}>
            <Link
              href={`/${row.original.domainName}`}
              className="group flex items-center gap-1.5"
            >
              <Favicon domain={row.original.domainName} size={16} />
              <span className="font-medium text-[13px] group-hover:underline">
                {row.original.domainName}
              </span>
            </Link>
          </ScreenshotTooltip>
        ),
      },
      {
        accessorKey: "verified",
        header: "Status",
        cell: ({ row }) => (
          <VerificationBadge
            verified={row.original.verified}
            verificationStatus={row.original.verificationStatus}
          />
        ),
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
            <div className="flex items-center gap-1 whitespace-nowrap text-[13px]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">
                    {format(date, "MMM d, yyyy")}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {formatDateTimeUtc(date.toISOString())}
                </TooltipContent>
              </Tooltip>
              <span className="text-[10px] text-muted-foreground leading-none">
                <RelativeExpiryString to={date} dangerDays={30} warnDays={45} />
              </span>
            </div>
          );
        },
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
        cell: ({ row }) => <ProviderCell provider={row.original.registrar} />,
      },
      {
        id: "dns",
        accessorFn: (row) => row.dns.name ?? "",
        header: "DNS",
        cell: ({ row }) => <ProviderCell provider={row.original.dns} />,
      },
      {
        id: "hosting",
        accessorFn: (row) => row.hosting.name ?? "",
        header: "Hosting",
        cell: ({ row }) => <ProviderCell provider={row.original.hosting} />,
      },
      {
        id: "email",
        accessorFn: (row) => row.email.name ?? "",
        header: "Email",
        cell: ({ row }) => <ProviderCell provider={row.original.email} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-7">
                <MoreVertical className="size-3.5" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  href={`/${row.original.domainName}`}
                  className="cursor-pointer"
                >
                  <ExternalLink className="size-3.5" />
                  View Report
                </Link>
              </DropdownMenuItem>
              {!row.original.verified && (
                <DropdownMenuItem
                  onClick={() => onVerify(row.original)}
                  className="cursor-pointer"
                >
                  <RefreshCw className="size-3.5" />
                  Verify Now
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem
                  onClick={() =>
                    onArchive(row.original.id, row.original.domainName)
                  }
                  className="cursor-pointer"
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
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [selectedIds, onToggleSelect, onVerify, onRemove, onArchive],
  );

  // Sync page size changes to pagination state
  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setPagination((prev) => ({
      ...prev,
      pageSize: newSize,
      pageIndex: 0, // Reset to first page when changing page size
    }));
  };

  const table = useReactTable({
    data: domains,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-black/15 bg-background/60 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/15">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-black/10 border-b bg-muted/30 dark:border-white/10"
              >
                {headerGroup.headers.map((header, index) => {
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

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "h-9 px-2.5 text-left align-middle font-medium text-muted-foreground text-xs",
                        index === 0 && "w-9 pl-4", // Checkbox column
                        index === headerGroup.headers.length - 1 && "pr-4",
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className={cn(
                            "-ml-1.5 inline-flex h-6 cursor-pointer select-none items-center gap-1 rounded px-1.5 text-xs transition-colors hover:bg-accent hover:text-foreground",
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
                      )}
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
              table.getRowModel().rows.map((row) => {
                const isUnverified = !row.original.verified;
                const isSelected = selectedIds.has(row.original.id);
                const cells = row.getVisibleCells();

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
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        isSelected && "bg-primary/10",
                      )}
                    >
                      {/* Checkbox column */}
                      {selectCell && (
                        <td className="h-12 w-9 pr-2.5 pl-4 align-middle">
                          {flexRender(
                            selectCell.column.columnDef.cell,
                            selectCell.getContext(),
                          )}
                        </td>
                      )}
                      {/* Domain column */}
                      {domainCell && (
                        <td className="h-12 px-2.5 align-middle">
                          {flexRender(
                            domainCell.column.columnDef.cell,
                            domainCell.getContext(),
                          )}
                        </td>
                      )}
                      {/* Status column */}
                      {statusCell && (
                        <td className="h-12 px-2.5 align-middle">
                          {flexRender(
                            statusCell.column.columnDef.cell,
                            statusCell.getContext(),
                          )}
                        </td>
                      )}
                      {/* Span remaining detail columns with verify message */}
                      <td
                        colSpan={collapseCount}
                        className="h-12 px-2.5 align-middle"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground text-xs">
                            Verify ownership to see domain details
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onVerify(row.original)}
                            className="h-8 cursor-pointer px-2 text-xs"
                          >
                            <RefreshCw className="size-3" />
                            Verify
                          </Button>
                        </div>
                      </td>
                      {/* Actions column */}
                      {actionsCell && (
                        <td className="h-12 px-2.5 pr-4 align-middle">
                          {flexRender(
                            actionsCell.column.columnDef.cell,
                            actionsCell.getContext(),
                          )}
                        </td>
                      )}
                    </tr>
                  );
                }

                // Verified domains show full row
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      isSelected && "bg-primary/10",
                    )}
                  >
                    {cells.map((cell, index) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "h-10 px-2.5 align-middle",
                          index === 0 && "w-9 pl-4",
                          index === cells.length - 1 && "pr-4",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls - only show if there are domains */}
      {domains.length > 0 && (
        <TablePagination
          pageIndex={table.getState().pagination.pageIndex}
          pageSize={pageSize}
          pageCount={table.getPageCount()}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPageChange={(index) => table.setPageIndex(index)}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Upgrade CTA banner for free tier users */}
      {tier === "free" && <UpgradeBanner proMaxDomains={proMaxDomains} />}
    </div>
  );
}
