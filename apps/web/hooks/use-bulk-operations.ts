import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";

type UseBulkOperationsOptions = {
  onComplete?: () => void;
};

export function useBulkOperations({ onComplete }: UseBulkOperationsOptions) {
  // Store callback in ref to avoid re-creating functions when onComplete changes
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const { bulkArchiveMutation, bulkDeleteMutation } = useTrackedDomains({
    includeArchived: true,
  });

  const executeBulkArchive = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await bulkArchiveMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        onCompleteRef.current?.();
        if (result.failedCount === 0) {
          toast.success(
            `Archived ${result.successCount} domain${result.successCount === 1 ? "" : "s"}`,
          );
        } else {
          toast.warning(
            `Archived ${result.successCount} of ${domainIds.length} domains (${result.failedCount} failed)`,
          );
        }
      } catch {
        // Error handled in mutation onError
      }
    },
    [bulkArchiveMutation],
  );

  const executeBulkDelete = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await bulkDeleteMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        onCompleteRef.current?.();
        if (result.failedCount === 0) {
          toast.success(
            `Deleted ${result.successCount} domain${result.successCount === 1 ? "" : "s"}`,
          );
        } else {
          toast.warning(
            `Deleted ${result.successCount} of ${domainIds.length} domains (${result.failedCount} failed)`,
          );
        }
      } catch {
        // Error handled in mutation onError
      }
    },
    [bulkDeleteMutation],
  );

  return {
    // Use mutation's built-in isPending instead of manual loading state
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
    executeBulkArchive,
    executeBulkDelete,
  };
}
