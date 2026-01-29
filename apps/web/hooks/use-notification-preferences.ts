"use client";

import type { NotificationCategory } from "@domainstack/constants";
import type {
  TrackedDomainWithDetails,
  UserNotificationPreferences,
} from "@domainstack/types";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  domainExpiry: { inApp: true, email: true },
  certificateExpiry: { inApp: true, email: true },
  registrationChanges: { inApp: true, email: true },
  providerChanges: { inApp: true, email: true },
  certificateChanges: { inApp: true, email: true },
};

export interface UseNotificationPreferencesReturn {
  /** All tracked domains */
  domains: TrackedDomainWithDetails[] | undefined;
  /** Global notification preferences (with defaults merged) */
  globalPrefs: UserNotificationPreferences | undefined;
  /** Whether queries are loading */
  isLoading: boolean;
  /** Whether queries failed */
  isError: boolean;
  /** Whether any mutation is pending */
  isPending: boolean;
  /** Update a global preference toggle */
  updateGlobalPreference: (
    category: NotificationCategory,
    type: "email" | "inApp",
    enabled: boolean,
  ) => void;
  /** Toggle muted state for a domain */
  setDomainMuted: (trackedDomainId: string, muted: boolean) => void;
}

/**
 * Hook for managing notification preferences.
 * Encapsulates queries and mutations for the notification settings panel.
 */
export function useNotificationPreferences(): UseNotificationPreferencesReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const globalPrefsQueryKey = trpc.user.getNotificationPreferences.queryKey();

  // Queries - both run in parallel
  const [domainsResult, globalPrefsResult] = useQueries({
    queries: [
      trpc.tracking.listDomains.queryOptions(),
      trpc.user.getNotificationPreferences.queryOptions(),
    ],
  });

  // Update global preferences mutation (optimistic)
  const updateGlobalMutation = useMutation({
    ...trpc.user.updateGlobalNotificationPreferences.mutationOptions(),
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: globalPrefsQueryKey });
      const previousPrefs =
        queryClient.getQueryData<UserNotificationPreferences>(
          globalPrefsQueryKey,
        );

      // Optimistically update
      queryClient.setQueryData<UserNotificationPreferences>(
        globalPrefsQueryKey,
        (old) => (old ? { ...old, ...newPrefs } : old),
      );

      return { previousPrefs };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData<UserNotificationPreferences>(
          globalPrefsQueryKey,
          context.previousPrefs,
        );
      }
      toast.error("Failed to update settings");
    },
    onSuccess: () => {
      toast.success("Global settings updated");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: globalPrefsQueryKey });
    },
  });

  // Set domain muted mutation (optimistic)
  const setDomainMutedMutation = useMutation({
    ...trpc.user.setDomainMuted.mutationOptions(),
    onMutate: async ({ trackedDomainId, muted }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      // Snapshot all domain query variants for rollback
      const previousDomains = queryClient.getQueriesData<
        typeof domainsResult.data
      >({
        queryKey: domainsQueryKey,
      });

      // Optimistically update the domain's muted state in all query variants
      queryClient.setQueriesData<typeof domainsResult.data>(
        { queryKey: domainsQueryKey },
        (old) =>
          old
            ? old.map((d) => (d.id === trackedDomainId ? { ...d, muted } : d))
            : old,
      );

      return { previousDomains };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDomains) {
        for (const [key, data] of context.previousDomains) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to update settings");
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.muted ? "Domain muted" : "Domain unmuted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    },
  });

  // Merge defaults with saved preferences to ensure new fields are always present
  const globalPrefs = globalPrefsResult.data
    ? { ...DEFAULT_PREFERENCES, ...globalPrefsResult.data }
    : undefined;

  const updateGlobalPreference = (
    category: NotificationCategory,
    type: "email" | "inApp",
    enabled: boolean,
  ) => {
    if (!globalPrefs) return;

    // Get current category preferences
    const currentPref = globalPrefs[category];

    // Update only the specific channel
    const updatedPref = {
      ...currentPref,
      [type]: enabled,
    };

    updateGlobalMutation.mutate({ [category]: updatedPref });
  };

  const setDomainMuted = (trackedDomainId: string, muted: boolean) => {
    setDomainMutedMutation.mutate({ trackedDomainId, muted });
  };

  return {
    domains: domainsResult.data,
    globalPrefs,
    isLoading: domainsResult.isLoading || globalPrefsResult.isLoading,
    isError: domainsResult.isError || globalPrefsResult.isError,
    isPending:
      updateGlobalMutation.isPending || setDomainMutedMutation.isPending,
    updateGlobalPreference,
    setDomainMuted,
  };
}
