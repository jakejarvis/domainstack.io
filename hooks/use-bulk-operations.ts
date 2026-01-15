import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";

type UseBulkOperationsOptions = {
  onComplete?: () => void;
};

export function useBulkOperations({ onComplete }: UseBulkOperationsOptions) {
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { bulkArchiveMutation, bulkDeleteMutation } = useTrackedDomains({
    includeArchived: true,
  });

  const executeBulkArchive = useCallback(
    async (domainIds: string[]) => {
      setIsBulkArchiving(true);
      try {
        const result = await bulkArchiveMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        onComplete?.();
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
      } finally {
        setIsBulkArchiving(false);
      }
    },
    [bulkArchiveMutation, onComplete],
  );

  const executeBulkDelete = useCallback(
    async (domainIds: string[]) => {
      setIsBulkDeleting(true);
      try {
        const result = await bulkDeleteMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        onComplete?.();
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
      } finally {
        setIsBulkDeleting(false);
      }
    },
    [bulkDeleteMutation, onComplete],
  );

  return {
    isBulkArchiving,
    isBulkDeleting,
    executeBulkArchive,
    executeBulkDelete,
  };
}
