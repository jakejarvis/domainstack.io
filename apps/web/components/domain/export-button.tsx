"use client";

import { IconDownload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { analytics } from "@/lib/analytics/client";
import { exportDomainData } from "@/lib/json-export";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@domainstack/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";

export function ExportButton({ domain, enabled = true }: { domain: string; enabled?: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKeys = useMemo(
    () => ({
      registration: trpc.domain.getRegistration.queryOptions({ domain }).queryKey,
      dns: trpc.domain.getDnsRecords.queryOptions({ domain }).queryKey,
      hosting: trpc.domain.getHosting.queryOptions({ domain }).queryKey,
      certificates: trpc.domain.getCertificates.queryOptions({ domain }).queryKey,
      headers: trpc.domain.getHeaders.queryOptions({ domain }).queryKey,
      seo: trpc.domain.getSeo.queryOptions({ domain }).queryKey,
    }),
    [trpc, domain],
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => queryClient.getQueryCache().subscribe(onStoreChange),
    [queryClient],
  );

  const allDataLoaded = useSyncExternalStore(
    subscribe,
    () =>
      Object.values(queryKeys).every((key) => {
        const query = queryClient.getQueryCache().find({ queryKey: key });
        return query?.state.data !== undefined || query?.state.status === "error";
      }),
    () => false,
  );

  const handleExport = useCallback(() => {
    analytics.track("export_json_clicked", { domain });

    try {
      const exportData: Record<string, unknown> = {};
      for (const key of Object.keys(queryKeys)) {
        const response = queryClient.getQueryData(queryKeys[key as keyof typeof queryKeys]);

        if (response?.data) {
          exportData[key] = response.data;
        }
      }

      exportDomainData(domain, exportData);
    } catch (err) {
      toast.error(`Failed to export ${domain}`, {
        description: err instanceof Error ? err.message : "An error occurred while exporting",
        position: "bottom-center",
      });
    }
  }, [domain, queryClient, queryKeys]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "pointer-events-auto",
              (!enabled || !allDataLoaded) && "cursor-not-allowed",
            )}
          >
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!enabled || !allDataLoaded}
              aria-label="Export report"
            >
              <IconDownload className="sm:text-muted-foreground" aria-hidden="true" />
              <span className="hidden sm:inline-block">Export</span>
            </Button>
          </div>
        }
      />
      <TooltipContent>
        Save this report as a <span className="font-mono">JSON</span> file
      </TooltipContent>
    </Tooltip>
  );
}
