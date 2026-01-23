import { CameraIcon } from "@phosphor-icons/react/ssr";
import { ExportButton } from "@/components/domain/export-button";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { ToolsDropdown } from "@/components/domain/tools-dropdown";
import { TrackDomainButton } from "@/components/domain/track-domain-button";
import { Favicon } from "@/components/icons/favicon";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface DomainReportHeaderProps {
  domain: string;
  domainId?: string;
  /** Whether the domain is confirmed registered. If false, render loading states. */
  isRegistered?: boolean;
}

/**
 * Header section for domain report showing domain name with favicon,
 * external link, export button, and tools dropdown.
 */
export function DomainReportHeader({
  domain,
  domainId,
  isRegistered,
  className,
  ...props
}: React.ComponentPropsWithRef<"div"> & DomainReportHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-4",
        className,
      )}
      {...props}
    >
      {isRegistered ? (
        <ScreenshotPopover
          domain={domain}
          domainId={domainId}
          align="start"
          side="bottom"
          sideOffset={8}
        >
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener"
            className="flex min-w-0 items-center gap-2"
          >
            <Favicon domain={domain} className="size-5 shrink-0" />
            <h2
              className="truncate font-semibold text-xl tracking-tight"
              title={domain}
            >
              {domain}
            </h2>
            <CameraIcon
              className="mr-3 ml-0.5 size-3.5 shrink-0 text-foreground/65"
              aria-hidden
            />
          </a>
        </ScreenshotPopover>
      ) : (
        <span className="flex min-w-0 cursor-default items-center gap-2">
          <Favicon domain={domain} className="size-5 shrink-0" />
          <h2
            className="truncate font-semibold text-xl tracking-tight"
            title={domain}
          >
            {domain}
          </h2>
          <Spinner
            className="ml-0.5 size-3.5 shrink-0 text-foreground/65"
            aria-hidden="true"
          />
        </span>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <TrackDomainButton domain={domain} enabled={isRegistered} />
        <ExportButton domain={domain} enabled={isRegistered} />
        <ToolsDropdown domain={domain} enabled={isRegistered} />
      </div>
    </div>
  );
}
