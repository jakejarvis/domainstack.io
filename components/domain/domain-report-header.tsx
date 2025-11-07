"use client";

import { ExternalLink } from "lucide-react";
import { ExportButton } from "@/components/domain/export-button";
import { Favicon } from "@/components/domain/favicon";
import { ScreenshotTooltip } from "@/components/domain/screenshot-tooltip";
import { ToolsDropdown } from "@/components/domain/tools-dropdown";
import { captureClient } from "@/lib/analytics/client";

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
    <div className="flex items-center justify-between">
      <ScreenshotTooltip domain={domain}>
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2"
          onClick={() =>
            captureClient("external_domain_link_clicked", { domain })
          }
        >
          <Favicon domain={domain} size={20} className="rounded" />
          <h2 className="font-semibold text-xl tracking-tight">{domain}</h2>
          <ExternalLink
            className="size-3.5 text-muted-foreground/60"
            aria-hidden="true"
          />
        </a>
      </ScreenshotTooltip>

      <div className="flex items-center gap-2">
        <ExportButton onExportAction={onExport} disabled={exportDisabled} />

        <ToolsDropdown domain={domain} />
      </div>
    </div>
  );
}
