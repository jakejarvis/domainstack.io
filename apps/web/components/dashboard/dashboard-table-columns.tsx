import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DomainActionsMenu } from "@/components/dashboard/domain-actions-menu";
import { DomainHealthBadge } from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderCell } from "@/components/dashboard/provider-cell";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
import { useIsDomainSelected, useToggleDomainSelection } from "@/hooks/use-dashboard-selection";
import type { DashboardTableFeatures } from "@/lib/dashboard-table-features";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Checkbox } from "@domainstack/ui/checkbox";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";
import { formatDate, formatDateTimeUtc, toDateTimeAttr } from "@domainstack/utils/date";

/**
 * Header labels for every column that renders a plain text header. Shared with
 * the column visibility menu so labels never drift between the table and the
 * menu that toggles it.
 */
const COLUMN_HEADERS = {
  domainName: "Domain",
  verified: "Status",
  health: "Health",
  expirationDate: "Expires",
  registrar: "Registrar",
  dns: "DNS",
  hosting: "Hosting",
  email: "Email",
  ca: "CA",
  registrationDate: "Registered",
  createdAt: "Added",
} as const;

type DomainSelectCellProps = {
  domainId: string;
  domainName: string;
};

function DateCell({ date }: { date: Date }) {
  const dateTime = toDateTimeAttr(date);

  if (!dateTime) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="text-[13px] whitespace-nowrap tabular-nums">
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          nativeButton={false}
          render={
            <time dateTime={dateTime} suppressHydrationWarning>
              {formatDate(date)}
            </time>
          }
        />
        <ResponsiveTooltipContent>
          <time dateTime={dateTime} suppressHydrationWarning>
            {formatDateTimeUtc(date)}
          </time>
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
    </div>
  );
}

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

export function createColumns(): ColumnDef<DashboardTableFeatures, TrackedDomainWithDetails>[] {
  return [
    // Selection checkbox column
    {
      id: "select",
      header: () => <span className="sr-only">Selection</span>, // Bulk select lives in the toolbar
      cell: ({ row }) => (
        <DomainSelectCell domainId={row.original.id} domainName={row.original.domainName} />
      ),
      size: 40,
      enableHiding: false, // Always show selection column
      meta: {
        className: "!pl-4.5 max-w-[40px] text-center",
        showForUnverified: true,
      },
    },
    {
      accessorKey: "domainName",
      header: COLUMN_HEADERS.domainName,
      cell: ({ row }) => (
        <ScreenshotPopover domain={row.original.domainName} domainId={row.original.domainId}>
          <Link
            href={`/${encodeURIComponent(row.original.domainName)}`}
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
      meta: { showForUnverified: true },
    },
    {
      accessorKey: "verified",
      header: COLUMN_HEADERS.verified,
      cell: ({ row }) => <DomainStatusBadge domain={row.original} />,
      size: 100,
      meta: { showForUnverified: true },
    },
    {
      id: "health",
      accessorFn: (row) => row.expirationDate?.getTime() ?? 0,
      header: COLUMN_HEADERS.health,
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
      header: COLUMN_HEADERS.expirationDate,
      cell: ({ row }) => {
        const date = row.original.expirationDate;
        if (!date) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return <DateCell date={date} />;
      },
      size: 110,
    },
    {
      id: "registrar",
      accessorFn: (row) => row.registrar.name ?? "",
      header: COLUMN_HEADERS.registrar,
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
      header: COLUMN_HEADERS.dns,
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
      header: COLUMN_HEADERS.hosting,
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
      header: COLUMN_HEADERS.email,
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
      header: COLUMN_HEADERS.ca,
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
      accessorKey: "registrationDate",
      header: COLUMN_HEADERS.registrationDate,
      cell: ({ row }) => {
        const date = row.original.registrationDate;
        if (!date) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return <DateCell date={date} />;
      },
      size: 110,
    },
    {
      accessorKey: "createdAt",
      header: COLUMN_HEADERS.createdAt,
      cell: ({ row }) => {
        const date = row.original.createdAt;
        return <DateCell date={date} />;
      },
      size: 110,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <DomainActionsMenu domain={row.original} triggerVariant="outline" />,
      size: 56,
      enableHiding: false, // Always show actions menu
      meta: {
        className: "!pr-4 text-right",
        showForUnverified: true,
      },
    },
  ];
}

// Share the exact definitions used by the table with its column menu. The menu
// lives outside the table, so it cannot read the table instance directly.
export const dashboardColumns = createColumns();

export const HIDEABLE_COLUMNS = dashboardColumns.flatMap((column) => {
  const id = column.id ?? ("accessorKey" in column ? column.accessorKey : undefined);
  return typeof id === "string" &&
    column.enableHiding !== false &&
    typeof column.header === "string"
    ? [{ id, header: column.header }]
    : [];
});

export const HIDEABLE_COLUMN_IDS = new Set(HIDEABLE_COLUMNS.map((column) => column.id));
