import { ExternalLink } from "lucide-react";
import { ExportButton } from "@/components/domain/export-button";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { ToolsDropdown } from "@/components/domain/tools-dropdown";
import { TrackDomainButton } from "@/components/domain/track-domain-button";
import { Favicon } from "@/components/icons/favicon";

interface DomainReportHeaderProps {
  domain: string;
  onExport: () => void;
  exportDisabled: boolean;
}

/**
 * Header section for domain report showing domain name with favicon,
 * external link, export button, and tools dropdown.
 */
export function DomainReportHeader({
  domain,
  onExport,
  exportDisabled,
}: DomainReportHeaderProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <ScreenshotPopover domain={domain}>
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener"
          className="flex min-w-0 items-center gap-2"
        >
          <Favicon
            domain={domain}
            size={20}
            className="flex-shrink-0 rounded"
          />
          <h2
            className="truncate font-semibold text-xl tracking-tight"
            title={domain}
          >
            {domain}
          </h2>
          <ExternalLink
            className="size-3.5 flex-shrink-0 text-muted-foreground/60"
            aria-hidden="true"
          />
        </a>
      </ScreenshotPopover>

      <div className="flex flex-shrink-0 items-center gap-2">
        <TrackDomainButton domain={domain} />

        <ExportButton onExport={onExport} disabled={exportDisabled} />

        <ToolsDropdown domain={domain} />
      </div>
    </div>
  );
}
