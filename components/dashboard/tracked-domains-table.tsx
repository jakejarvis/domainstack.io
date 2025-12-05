"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Archive,
  ArrowUpDown,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { Favicon } from "@/components/domain/favicon";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ScreenshotTooltip } from "@/components/domain/screenshot-tooltip";
import { Button } from "@/components/ui/button";
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
import type {
  ProviderInfo,
  TrackedDomainWithDetails,
} from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type TrackedDomainsTableProps = {
  domains: TrackedDomainWithDetails[];
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string) => void;
  onArchive?: (id: string) => void;
};

function ProviderCell({ provider }: { provider: ProviderInfo }) {
  if (!provider.name) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {provider.domain && (
        <Favicon domain={provider.domain} size={14} className="shrink-0" />
      )}
      <span className="truncate">{provider.name}</span>
    </div>
  );
}

function SortableHeader({
  column,
  children,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: () => void;
  };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2 font-medium text-[12px] text-muted-foreground hover:text-foreground"
      onClick={() => column.toggleSorting()}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "ml-1 size-3 opacity-50",
          sorted && "text-foreground opacity-100",
        )}
      />
    </Button>
  );
}

export function TrackedDomainsTable({
  domains,
  onVerify,
  onRemove,
  onArchive,
}: TrackedDomainsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<TrackedDomainWithDetails>[]>(
    () => [
      {
        accessorKey: "domainName",
        header: ({ column }) => (
          <SortableHeader column={column}>Domain</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Favicon domain={row.original.domainName} size={18} />
            <ScreenshotTooltip domain={row.original.domainName}>
              <Link
                href={`/${row.original.domainName}`}
                className="font-medium hover:underline"
              >
                {row.original.domainName}
              </Link>
            </ScreenshotTooltip>
          </div>
        ),
      },
      {
        accessorKey: "verified",
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <VerificationBadge
            verified={row.original.verified}
            verificationStatus={row.original.verificationStatus}
          />
        ),
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
        header: ({ column }) => (
          <SortableHeader column={column}>Health</SortableHeader>
        ),
        cell: ({ row }) => (
          <DomainHealthBadge
            expirationDate={row.original.expirationDate}
            verified={row.original.verified}
          />
        ),
      },
      {
        accessorKey: "expirationDate",
        header: ({ column }) => (
          <SortableHeader column={column}>Expires</SortableHeader>
        ),
        cell: ({ row }) => {
          const date = row.original.expirationDate;
          if (!date) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">
                    {format(date, "MMM d, yyyy")}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(date, "yyyy-MM-dd HH:mm:ss")} UTC
                </TooltipContent>
              </Tooltip>
              <span className="text-[11px] text-muted-foreground leading-none">
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
        header: ({ column }) => (
          <SortableHeader column={column}>Registrar</SortableHeader>
        ),
        cell: ({ row }) => <ProviderCell provider={row.original.registrar} />,
      },
      {
        id: "dns",
        accessorFn: (row) => row.dns.name ?? "",
        header: ({ column }) => (
          <SortableHeader column={column}>DNS</SortableHeader>
        ),
        cell: ({ row }) => <ProviderCell provider={row.original.dns} />,
      },
      {
        id: "hosting",
        accessorFn: (row) => row.hosting.name ?? "",
        header: ({ column }) => (
          <SortableHeader column={column}>Hosting</SortableHeader>
        ),
        cell: ({ row }) => <ProviderCell provider={row.original.hosting} />,
      },
      {
        id: "email",
        accessorFn: (row) => row.email.name ?? "",
        header: ({ column }) => (
          <SortableHeader column={column}>Email</SortableHeader>
        ),
        cell: ({ row }) => <ProviderCell provider={row.original.email} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
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
                  onClick={() => onArchive(row.original.id)}
                  className="cursor-pointer"
                >
                  <Archive className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRemove(row.original.id)}
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
    [onVerify, onRemove, onArchive],
  );

  const table = useReactTable({
    data: domains,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 bg-background/60 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-black/10 border-b bg-muted/30 dark:border-white/10"
              >
                {headerGroup.headers.map((header, index) => (
                  <th
                    key={header.id}
                    className={cn(
                      "h-10 px-3 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider",
                      index === 0 && "pl-5",
                      index === headerGroup.headers.length - 1 && "pr-5",
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-20 text-center text-muted-foreground text-sm"
                >
                  No domains tracked yet.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "h-12 px-3 align-middle",
                        index === 0 && "pl-5",
                        index === row.getVisibleCells().length - 1 && "pr-5",
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
