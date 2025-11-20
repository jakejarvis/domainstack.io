"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Calendar, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useTRPC, useTRPCClient } from "@/lib/trpc/client";

function MonitoredDomainsListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="mb-4 size-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold text-lg">No monitored domains</h3>
        <p className="mb-4 text-center text-muted-foreground text-sm">
          Start monitoring domains to receive alerts about expiry dates and
          changes
        </p>
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm hover:bg-primary/90"
        >
          Search for a domain
        </Link>
      </CardContent>
    </Card>
  );
}

export function MonitoredDomainsList() {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const { data: monitored, isLoading } = useQuery(
    trpc.monitoring.getMonitoredDomains.queryOptions(),
  );

  const { mutateAsync: toggleMonitoring, isPending: togglePending } =
    useMutation({
      mutationFn: (vars: { domainId: string; enabled: boolean }) =>
        trpcClient.monitoring.toggleDomainMonitoring.mutate(vars),
      onSuccess: () => {
        toast.success("Monitoring preferences updated");
        queryClient.invalidateQueries({
          queryKey: trpc.monitoring.getMonitoredDomains.queryOptions().queryKey,
        });
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });

  const { mutateAsync: updateSettings, isPending: updatePending } = useMutation(
    {
      mutationFn: (vars: {
        domainId: string;
        notifyOnDomainExpiry?: boolean;
        notifyOnCertExpiry?: boolean;
      }) => trpcClient.monitoring.updateMonitorSettings.mutate(vars),
      onSuccess: () => {
        toast.success("Alert preferences updated");
        queryClient.invalidateQueries({
          queryKey: trpc.monitoring.getMonitoredDomains.queryOptions().queryKey,
        });
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    },
  );

  const handleToggleMonitoring = async (domainId: string, enabled: boolean) => {
    // Optimistic update
    queryClient.setQueryData(
      trpc.monitoring.getMonitoredDomains.queryOptions().queryKey,
      (old: typeof monitored) => {
        if (!old) return old;
        if (!enabled) {
          return old.filter((m) => m.domainId !== domainId);
        }
        return old;
      },
    );

    await toggleMonitoring({ domainId, enabled });
  };

  const handleUpdateSetting = async (
    domainId: string,
    setting: "notifyOnDomainExpiry" | "notifyOnCertExpiry",
    value: boolean,
  ) => {
    // Optimistic update
    queryClient.setQueryData(
      trpc.monitoring.getMonitoredDomains.queryOptions().queryKey,
      (old: typeof monitored) => {
        if (!old) return old;
        return old.map((m) =>
          m.domainId === domainId ? { ...m, [setting]: value } : m,
        );
      },
    );

    await updateSettings({
      domainId,
      [setting]: value,
    });
  };

  if (isLoading) {
    return <MonitoredDomainsListSkeleton />;
  }

  if (!monitored || monitored.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {monitored.map((monitor: NonNullable<typeof monitored>[number]) => {
        const domainExpiring =
          monitor.registrationExpiry &&
          new Date(monitor.registrationExpiry) <
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const certExpiring =
          monitor.certExpiry &&
          new Date(monitor.certExpiry) <
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        return (
          <Card key={monitor.monitorId}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    <Link
                      href={`/${monitor.domainName}`}
                      className="hover:underline"
                    >
                      {monitor.unicodeName}
                    </Link>
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Monitoring since{" "}
                    {formatDistanceToNow(new Date(monitor.monitoredSince), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={true}
                    onCheckedChange={(checked) =>
                      handleToggleMonitoring(monitor.domainId, checked)
                    }
                    disabled={togglePending}
                  />
                  {togglePending && <Loader2 className="size-4 animate-spin" />}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Expiry info */}
              <div className="flex flex-wrap gap-4 text-sm">
                {monitor.registrationExpiry && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span>
                      Domain expires{" "}
                      {formatDistanceToNow(
                        new Date(monitor.registrationExpiry),
                        {
                          addSuffix: true,
                        },
                      )}
                    </span>
                    {domainExpiring && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
                        Soon
                      </span>
                    )}
                  </div>
                )}
                {monitor.certExpiry && (
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    <span>
                      Certificate expires{" "}
                      {formatDistanceToNow(new Date(monitor.certExpiry), {
                        addSuffix: true,
                      })}
                    </span>
                    {certExpiring && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
                        Soon
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Alert settings */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Alert Preferences</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`domain-expiry-${monitor.monitorId}`}
                      className="cursor-pointer font-normal text-sm"
                    >
                      Domain expiry alerts
                    </Label>
                    <Switch
                      id={`domain-expiry-${monitor.monitorId}`}
                      checked={monitor.notifyOnDomainExpiry ?? true}
                      onCheckedChange={(checked) =>
                        handleUpdateSetting(
                          monitor.domainId,
                          "notifyOnDomainExpiry",
                          checked,
                        )
                      }
                      disabled={updatePending}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`cert-expiry-${monitor.monitorId}`}
                      className="cursor-pointer font-normal text-sm"
                    >
                      Certificate expiry alerts
                    </Label>
                    <Switch
                      id={`cert-expiry-${monitor.monitorId}`}
                      checked={monitor.notifyOnCertExpiry ?? true}
                      onCheckedChange={(checked) =>
                        handleUpdateSetting(
                          monitor.domainId,
                          "notifyOnCertExpiry",
                          checked,
                        )
                      }
                      disabled={updatePending}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
