import { IconCamera } from "@tabler/icons-react";
import Link from "next/link";

import { ExportButton } from "@/components/domain/export-button";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { ToolsDropdown } from "@/components/domain/tools-dropdown";
import { TrackDomainButton } from "@/components/domain/track-domain-button";
import { Favicon } from "@/components/icons/favicon";
import { Badge } from "@domainstack/ui/badge";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

interface DomainReportHeaderProps {
  /** The exact hostname the report describes. */
  hostname: string;
  /** The hostname's registrable domain, which owns registration and tracking. */
  registrableDomain: string;
  /**
   * Database id of the `hostname` row, once known (the screenshot waits for
   * it). Never pass the registrable domain's id for a subdomain report: the
   * screenshot would be stored under it.
   */
  domainId?: string;
  /** Whether registration has settled. Until then, render loading states. */
  isReady?: boolean;
  /** Whether the registrable domain is confirmed registered (gates tracking). */
  isRegistered?: boolean;
}

/**
 * Header section for domain report showing the hostname with favicon, external
 * link, export button, and tools dropdown. A subdomain report also names its
 * registered domain, which is what Track follows.
 */
export function DomainReportHeader({
  hostname,
  registrableDomain,
  domainId,
  isReady,
  isRegistered,
  className,
  ...props
}: React.ComponentPropsWithRef<"div"> & DomainReportHeaderProps) {
  const isSubdomain = hostname !== registrableDomain;

  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-4", className)} {...props}>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {isReady ? (
            <ScreenshotPopover
              domain={hostname}
              domainId={domainId}
              align="start"
              side="bottom"
              sideOffset={8}
            >
              <a
                href={`https://${hostname}`}
                target="_blank"
                rel="noopener"
                className="flex min-w-0 items-center gap-2"
              >
                <Favicon domain={hostname} className="size-5 shrink-0" />
                <h2 className="truncate text-xl font-semibold tracking-tight" title={hostname}>
                  {hostname}
                </h2>
                <IconCamera
                  className="mr-3 ml-0.5 size-3.5 shrink-0 text-foreground/65"
                  aria-hidden
                />
              </a>
            </ScreenshotPopover>
          ) : (
            <span className="flex min-w-0 cursor-default items-center gap-2">
              <Favicon domain={hostname} className="size-5 shrink-0" />
              <h2 className="truncate text-xl font-semibold tracking-tight" title={hostname}>
                {hostname}
              </h2>
              <Spinner className="ml-0.5 size-3.5 shrink-0 text-foreground/65" aria-hidden="true" />
            </span>
          )}
          {isSubdomain && (
            <Badge variant="outline" className="text-muted-foreground">
              Subdomain
            </Badge>
          )}
        </div>
        {isSubdomain && (
          <p className="truncate text-[13px] text-muted-foreground">
            Registered domain:{" "}
            <Link
              href={`/${encodeURIComponent(registrableDomain)}`}
              className="text-foreground/80 underline-offset-2 hover:underline"
            >
              {registrableDomain}
            </Link>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Tracking and verification stay at the registrable domain. */}
        <TrackDomainButton
          domain={registrableDomain}
          enabled={isRegistered}
          forSubdomain={isSubdomain}
        />
        <ExportButton hostname={hostname} registrableDomain={registrableDomain} enabled={isReady} />
        <ToolsDropdown domain={hostname} enabled={isReady} />
      </div>
    </div>
  );
}
