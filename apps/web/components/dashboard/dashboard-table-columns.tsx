"use no memo"; // Disable React Compiler memoization - TanStack Table has issues with it

import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  BellIcon,
  BellSlashIcon,
  BookmarkSimpleIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
} from "@phosphor-icons/react/ssr";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderCell } from "@/components/dashboard/provider-cell";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
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
import { formatDateTimeUtc } from "@/lib/format";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";
import { cn } from "@/lib/utils";

// Define custom column meta for styling
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
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
export function createUnverifiedLastSorter(
  isDescFn: (columnId: string) => boolean,
) {
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

export type ColumnCallbacks = {
  selectedIdsRef: React.RefObject<Set<string>>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
  withUnverifiedLast: ReturnType<typeof createUnverifiedLastSorter>;
};

export function createColumns(
  callbacks: ColumnCallbacks,
): ColumnDef<TrackedDomainWithDetails>[] {
  const {
    selectedIdsRef,
    onToggleSelect,
    onVerify,
    onRemove,
    onArchive,
    onToggleMuted,
    withUnverifiedLast,
  } = callbacks;

  return [
    // Selection checkbox column
    {
      id: "select",
      header: () => null, // No header checkbox here - it's in the bulk toolbar
      cell: ({ row }) => {
        // Read from ref to avoid columns recreation on selection change
        const isSelected = selectedIdsRef.current?.has(row.original.id);
        return (
          <div className="relative size-4">
            {/* Favicon - hidden on hover or when selected */}
            <Favicon
              domain={row.original.domainName}
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
                "absolute inset-0",
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
        <ScreenshotPopover
          domain={row.original.domainName}
          domainId={row.original.domainId}
        >
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
              isFailing || isPending ? () => onVerify(row.original) : undefined
            }
          />
        );
      },
      size: 100,
      // Sort verified domains first (verified = -1, unverified = 1)
      sortingFn: (rowA, rowB) =>
        rowA.original.verified === rowB.original.verified
          ? 0
          : rowA.original.verified
            ? -1
            : 1,
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
          return <span className="text-muted-foreground text-xs">-</span>;
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
          return <span className="text-muted-foreground text-xs">-</span>;
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
      sortingFn: (rowA, rowB) =>
        rowA.original.createdAt.getTime() - rowB.original.createdAt.getTime(),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon-sm">
                <DotsThreeVerticalIcon weight="bold" />
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
                  <ArrowSquareOutIcon />
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
                  <BookmarkSimpleIcon />
                  View Report
                </Link>
              }
            />
            <DropdownMenuSeparator />
            {row.original.verified && (
              <DropdownMenuItem
                onClick={() =>
                  onToggleMuted(row.original.id, !row.original.muted)
                }
              >
                {row.original.muted ? (
                  <>
                    <BellIcon />
                    Unmute
                  </>
                ) : (
                  <>
                    <BellSlashIcon />
                    Mute
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                onArchive(row.original.id, row.original.domainName)
              }
            >
              <ArchiveIcon />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRemove(row.original.id, row.original.domainName)}
            >
              <TrashIcon className="text-danger-foreground" />
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
