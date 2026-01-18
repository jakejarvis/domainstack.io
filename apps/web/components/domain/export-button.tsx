"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useReportExport } from "@/hooks/use-report-export";

export function ExportButton({
  domain,
  enabled = true,
}: {
  domain: string;
  enabled?: boolean;
}) {
  // Track export state and get export handler
  const { handleExport, allDataLoaded } = useReportExport(domain);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!enabled || !allDataLoaded}
            aria-label="Export report"
          >
            <DownloadSimpleIcon
              className="sm:text-muted-foreground"
              aria-hidden="true"
            />
            <span className="hidden sm:inline-block">Export</span>
          </Button>
        }
      />
      <TooltipContent>
        Save this report as a <span className="font-mono">JSON</span> file
      </TooltipContent>
    </Tooltip>
  );
}
