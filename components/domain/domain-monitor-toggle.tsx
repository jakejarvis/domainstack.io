"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { signIn, useSession } from "@/lib/auth-client";
import { useTRPC, useTRPCClient } from "@/lib/trpc/client";

interface DomainMonitorToggleProps {
  domainName: string;
}

export function DomainMonitorToggle({ domainName }: DomainMonitorToggleProps) {
  const { data: session, isPending: sessionLoading } = useSession();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery(
    trpc.monitoring.getMonitoringStatusByName.queryOptions(
      { domainName },
      { enabled: !!session },
    ),
  );

  const { mutateAsync: toggleMonitoring, isPending: togglePending } =
    useMutation({
      mutationFn: (vars: { domainName: string; enabled: boolean }) =>
        trpcClient.monitoring.toggleDomainMonitoringByName.mutate(vars),
      onSuccess: (data) => {
        toast.success(
          data.enabled
            ? "Now monitoring this domain"
            : "Stopped monitoring this domain",
        );
        queryClient.invalidateQueries({
          queryKey: trpc.monitoring.getMonitoringStatusByName.queryOptions({
            domainName,
          }).queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.monitoring.getMonitoredDomains.queryOptions().queryKey,
        });
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });

  const handleToggle = async (checked: boolean) => {
    // Optimistic update
    queryClient.setQueryData(
      trpc.monitoring.getMonitoringStatusByName.queryOptions({ domainName })
        .queryKey,
      (old: typeof status) => {
        if (!old) return old;
        return { ...old, isMonitored: checked };
      },
    );

    await toggleMonitoring({ domainName, enabled: checked });
  };

  const handleSignIn = () => {
    signIn.social({
      provider: "github",
      callbackURL: window.location.href,
    });
  };

  if (sessionLoading) {
    return null;
  }

  if (!session) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignIn}
        className="gap-2"
      >
        <Bell className="size-4" />
        Sign in to monitor
      </Button>
    );
  }

  if (statusLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="monitor-toggle"
        className="cursor-pointer font-normal text-sm"
      >
        <Bell className="inline size-4" /> Monitor
      </Label>
      <Switch
        id="monitor-toggle"
        checked={status?.isMonitored ?? false}
        onCheckedChange={handleToggle}
        disabled={togglePending}
      />
      {togglePending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
