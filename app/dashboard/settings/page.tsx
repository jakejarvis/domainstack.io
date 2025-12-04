"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/lib/auth-client";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { useTRPC } from "@/lib/trpc/client";

export default function SettingsPage() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const updateMutation = useMutation(
    trpc.tracking.updateNotifications.mutationOptions(),
  );

  const handleToggleNotification = async (
    id: string,
    notifyDomainExpiry: boolean,
  ) => {
    try {
      await updateMutation.mutateAsync({
        trackedDomainId: id,
        notifyDomainExpiry,
      });
      domainsQuery.refetch();
      toast.success("Notification settings updated");
    } catch {
      toast.error("Failed to update settings");
    }
  };

  if (domainsQuery.isLoading) {
    return <SettingsSkeleton />;
  }

  const domains = (domainsQuery.data ?? []) as TrackedDomainWithDetails[];
  const verifiedDomains = domains.filter(
    (d: TrackedDomainWithDetails) => d.verified,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">Notification Settings</h1>
        <p className="text-muted-foreground">
          Manage how and when you receive alerts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Alerts will be sent to{" "}
            <span className="font-medium text-foreground">
              {session?.user?.email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Domain expiration alerts</div>
                <div className="text-muted-foreground text-sm">
                  Notifications sent 30, 14, 7, and 1 day before expiration
                </div>
              </div>
            </div>
          </div>

          {verifiedDomains.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Per-domain settings</h3>
              {verifiedDomains.map((domain: TrackedDomainWithDetails) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="font-medium">{domain.domainName}</div>
                    <div className="text-muted-foreground text-sm">
                      {domain.notifyDomainExpiry
                        ? "Notifications enabled"
                        : "Notifications disabled"}
                    </div>
                  </div>
                  <Switch
                    checked={domain.notifyDomainExpiry}
                    onCheckedChange={(checked) =>
                      handleToggleNotification(domain.id, checked)
                    }
                    disabled={updateMutation.isPending}
                  />
                </div>
              ))}
            </div>
          )}

          {verifiedDomains.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Verify your domains to enable notifications.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
