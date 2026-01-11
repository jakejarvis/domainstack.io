import { CameraIcon } from "@phosphor-icons/react/ssr";
import { ExportButton } from "@/components/domain/export-button";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { ToolsDropdown } from "@/components/domain/tools-dropdown";
import { TrackDomainButton } from "@/components/domain/track-domain-button";
import { Favicon } from "@/components/icons/favicon";
import { cn } from "@/lib/utils";

interface DomainReportHeaderProps {
  domain: string;
  domainId?: string;
  /** Whether the domain is confirmed registered. Undefined = still loading. */
  isRegistered?: boolean;
  onExport: () => void;
  exportDisabled: boolean;
}

/**
 * Header section for domain report showing domain name with favicon,
 * external link, export button, and tools dropdown.
 */
export function DomainReportHeader({
  domain,
  domainId,
  isRegistered,
  onExport,
  exportDisabled,
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
            className="ml-0.5 size-4 flex-shrink-0 text-foreground/65"
            aria-hidden
          />
        </a>
      </ScreenshotPopover>

      <div className="flex flex-shrink-0 items-center gap-2">
        <TrackDomainButton domain={domain} enabled={isRegistered} />

        <ExportButton
          onExport={onExport}
          disabled={!isRegistered || exportDisabled}
        />

        <ToolsDropdown domain={domain} />
      </div>
    </div>
  );
}
