"use client";

import { Button } from "@domainstack/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import { IconDownload } from "@tabler/icons-react";
import { notifyManager, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { exportDomainData } from "@/lib/json-export";
import { useTRPC } from "@/lib/trpc/client";

export function ExportButton({
  domain,
  enabled = true,
}: {
  domain: string;
  enabled?: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [allDataLoaded, setAllDataLoaded] = useState(false);

  const queryKeys = useMemo(
    () => ({
      registration: trpc.domain.getRegistration.queryOptions({ domain })
        .queryKey,
      dns: trpc.domain.getDnsRecords.queryOptions({ domain }).queryKey,
      hosting: trpc.domain.getHosting.queryOptions({ domain }).queryKey,
      certificates: trpc.domain.getCertificates.queryOptions({ domain })
        .queryKey,
      headers: trpc.domain.getHeaders.queryOptions({ domain }).queryKey,
      seo: trpc.domain.getSeo.queryOptions({ domain }).queryKey,
    }),
    [trpc, domain],
  );

  const queryKeysRef = useRef(queryKeys);
  useEffect(() => {
    queryKeysRef.current = queryKeys;
  }, [queryKeys]);

  useEffect(() => {
    const checkAndUpdateDataStatus = () => {
      const hasAllData = Object.values(queryKeysRef.current).every((key) => {
        const query = queryClient.getQueryCache().find({ queryKey: key });
        return (
          query?.state.data !== undefined || query?.state.status === "error"
        );
      });
      notifyManager.schedule(() => {
        setAllDataLoaded(hasAllData);
      });
    };

    const unsubscribe = queryClient
      .getQueryCache()
      .subscribe(checkAndUpdateDataStatus);
    checkAndUpdateDataStatus();

    return unsubscribe;
  }, [queryClient]);

  const handleExport = useCallback(() => {
    analytics.track("export_json_clicked", { domain });

    try {
      const exportData: Record<string, unknown> = {};
      for (const key of Object.keys(queryKeys)) {
        const response = queryClient.getQueryData(
          queryKeysRef.current[key as keyof typeof queryKeys],
        ) as { success?: boolean; data?: unknown } | undefined;

        if (response?.data) {
          exportData[key] = response.data;
        }
      }

      exportDomainData(domain, exportData);
    } catch (err) {
      toast.error(`Failed to export ${domain}`, {
        description:
          err instanceof Error
            ? err.message
            : "An error occurred while exporting",
        position: "bottom-center",
      });
    }
  }, [domain, queryClient, queryKeys]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!enabled || !allDataLoaded}
            focusableWhenDisabled
            aria-label="Export report"
          >
            <IconDownload
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
