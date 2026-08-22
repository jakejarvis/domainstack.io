import {
  IconArchive,
  IconBell,
  IconBellOff,
  IconBookmark,
  IconDotsVertical,
  IconExternalLink,
  IconTrash,
} from "@tabler/icons-react";
import type { ColumnDef, RowData, TableFeatures } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";

import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderCell } from "@/components/dashboard/provider-cell";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
import { useIsDomainSelected, useToggleDomainSelection } from "@/hooks/use-dashboard-selection";
import type { DashboardTableFeatures } from "@/lib/dashboard-table-features";
import type { VerificationMethod } from "@domainstack/constants";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Checkbox } from "@domainstack/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";
import { formatDateTimeUtc } from "@domainstack/utils";

// Define custom column meta for styling
declare module "@tanstack/react-table" {
  interface ColumnMeta<TFeatures extends TableFeatures, TData extends RowData, TValue> {
    className?: string;
  }
}

/**
 * Creates a sorting function factory that pushes unverified domains to the end.
 * Returns a function that creates sortingFn functions with access to the current sort state.
 *
 * TanStack Table multiplies the sortingFn result by -1 for descending sorts,
 * so we need to counteract this to keep unverified domains at the end.
 *
 * @param isDescFn - Function that returns whether the current column is sorted descending
 */
export function createUnverifiedLastSorter(isDescFn: (columnId: string) => boolean) {
  return function withUnverifiedLast(
    compareFn: (a: TrackedDomainWithDetails, b: TrackedDomainWithDetails) => number,
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

type DomainSelectCellProps = {
  domainId: string;
  domainName: string;
};

/**
 * Subscribes to selection itself so the compiler can memoize the table/row
 * while this checkbox still updates. Selection is app state (Jotai), not
 * TanStack row-selection, so `table.Subscribe` does not apply here.
 */
function DomainSelectCell({ domainId, domainName }: DomainSelectCellProps) {
  const isSelected = useIsDomainSelected(domainId);
  const toggle = useToggleDomainSelection();

  return (
    <div className="relative size-4">
      {/* Favicon - hidden on hover, keyboard focus, or when selected */}
      <Favicon
        domain={domainName}
        className={cn(
          "absolute inset-0",
          isSelected ? "hidden" : "group-focus-within:hidden group-hover:hidden",
        )}
      />
      {/* Checkbox stays mounted so it remains focusable when unselected */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => toggle(domainId)}
        aria-label={`Select ${domainName}`}
        className={cn(
          "absolute inset-0",
          isSelected
            ? "opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      />
    </div>
  );
}

export type ColumnCallbacks = {
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
  withUnverifiedLast: ReturnType<typeof createUnverifiedLastSorter>;
};

export function createColumns(
  callbacks: ColumnCallbacks,
): ColumnDef<DashboardTableFeatures, TrackedDomainWithDetails>[] {
  const { onVerify, onRemove, onArchive, onToggleMuted, withUnverifiedLast } = callbacks;

  return [
    // Selection checkbox column
    {
      id: "select",
      header: () => null, // No header checkbox here - it's in the bulk toolbar
      cell: ({ row }) => (
        <DomainSelectCell domainId={row.original.id} domainName={row.original.domainName} />
      ),
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
        <ScreenshotPopover domain={row.original.domainName} domainId={row.original.domainId}>
          <Link
            href={`/${encodeURIComponent(row.original.domainName)}`}
            prefetch={false}
            className="group/link flex items-center"
            data-disable-progress
          >
            <span className="text-[13px] font-medium group-hover/link:underline">
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
        const isFailing = row.original.verified && row.original.verificationStatus === "failing";
        const isPending = !row.original.verified;

        return (
          <DomainStatusBadge
            verified={row.original.verified}
            verificationStatus={row.original.verificationStatus}
            verificationMethod={row.original.verificationMethod}
            verificationFailedAt={row.original.verificationFailedAt}
            onClick={
              isFailing || isPending
                ? () => onVerify(row.original.id, row.original.verificationMethod)
                : undefined
            }
          />
        );
      },
      size: 100,
      // Sort verified domains first (verified = -1, unverified = 1)
      sortFn: (rowA, rowB) =>
        rowA.original.verified === rowB.original.verified ? 0 : rowA.original.verified ? -1 : 1,
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
      sortFn: withUnverifiedLast((a, b) => {
        const now = new Date();
        const getHealthPriority = (exp: Date | null, verified: boolean): number => {
          if (!verified || !exp) return 3; // unknown
          const days = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <div className="text-[13px] whitespace-nowrap">
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
      sortFn: withUnverifiedLast((a, b) => {
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
      sortFn: withUnverifiedLast((a, b) => {
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
      sortFn: withUnverifiedLast((a, b) => {
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
      sortFn: withUnverifiedLast((a, b) => {
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
      sortFn: withUnverifiedLast((a, b) => {
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
      sortFn: withUnverifiedLast((a, b) => {
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
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <div className="text-[13px] whitespace-nowrap">
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
      sortFn: withUnverifiedLast((a, b) => {
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
          <div className="text-[13px] whitespace-nowrap">
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
      sortFn: (rowA, rowB) => rowA.original.createdAt.getTime() - rowB.original.createdAt.getTime(),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon-sm">
                <IconDotsVertical />
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
                  <IconExternalLink />
                  Open
                </a>
              }
            />
            <DropdownMenuItem
              nativeButton={false}
              render={
                <Link href={`/${encodeURIComponent(row.original.domainName)}`} prefetch={false}>
                  <IconBookmark />
                  View Report
                </Link>
              }
            />
            <DropdownMenuSeparator />
            {row.original.verified && (
              <DropdownMenuItem onClick={() => onToggleMuted(row.original.id, !row.original.muted)}>
                {row.original.muted ? (
                  <>
                    <IconBell />
                    Unmute
                  </>
                ) : (
                  <>
                    <IconBellOff />
                    Mute
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onArchive(row.original.id, row.original.domainName)}>
              <IconArchive />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRemove(row.original.id, row.original.domainName)}>
              <IconTrash className="text-danger-foreground" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 56,
      enableHiding: false, // Always show actions menu
      meta: {
        className: "!pr-4 text-right",
      },
    },
  ];
}
