import { notifyManager, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { exportDomainData } from "@/lib/json-export";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Hook to handle domain data export and track when all section data is loaded.
 * Subscribes to query cache updates and provides a handler to export all domain data.
 */
export function useReportExport(domain: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [allDataLoaded, setAllDataLoaded] = useState(false);

  // Build query keys directly using tRPC's queryOptions
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

  // Update ref when queryKeys change
  useEffect(() => {
    queryKeysRef.current = queryKeys;
  }, [queryKeys]);

  // Check if all section data is loaded or has cached errors
  useEffect(() => {
    // Check if all queries have data or cached errors and schedule state update
    const checkAndUpdateDataStatus = () => {
      const hasAllData = Object.values(queryKeysRef.current).every((key) => {
        const query = queryClient.getQueryCache().find({ queryKey: key });
        // Consider data loaded if query has data OR has a cached error state
        return (
          query?.state.data !== undefined || query?.state.status === "error"
        );
      });
      // Use TanStack Query's notifyManager to schedule state update in the next batch
      // This prevents updating parent component during child render phase
      notifyManager.schedule(() => {
        setAllDataLoaded(hasAllData);
      });
    };

    // Subscribe to query cache updates to reactively check data availability
    const unsubscribe = queryClient
      .getQueryCache()
      .subscribe(checkAndUpdateDataStatus);

    // Initial check
    checkAndUpdateDataStatus();

    return unsubscribe;
  }, [queryClient]); // Only resubscribe if queryClient changes

  // Export handler that reads all data from React Query cache
  const handleExport = useCallback(() => {
    analytics.track("export_json_clicked", { domain });

    try {
      // Read data from cache using query keys
      // tRPC responses are wrapped in { success, cached, data }, so we unwrap the .data property
      const exportData: Record<string, unknown> = {};
      for (const key of Object.keys(queryKeys)) {
        const response = queryClient.getQueryData(
          queryKeysRef.current[key as keyof typeof queryKeys],
        ) as { success?: boolean; data?: unknown } | undefined;

        // Extract the nested .data property from the tRPC response wrapper
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

  return { handleExport, allDataLoaded };
}
