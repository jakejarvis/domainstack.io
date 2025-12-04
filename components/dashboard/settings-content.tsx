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
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";

interface SettingsContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
}

export function SettingsContent({ showCard = true }: SettingsContentProps) {
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
    } catch (err) {
      logger.error("Failed to update notification settings", err);
      toast.error("Failed to update settings");
    }
  };

  if (domainsQuery.isLoading) {
    return <SettingsContentSkeleton showCard={showCard} />;
  }

  const domains = domainsQuery.data ?? [];
  const verifiedDomains = domains.filter((d) => d.verified);

  const content = (
    <>
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
            {verifiedDomains.map((domain) => (
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
    </>
  );

  if (!showCard) {
    return <div className="flex flex-col">{content}</div>;
  }

  return <Card>{content}</Card>;
}

function SettingsContentSkeleton({ showCard = true }: { showCard?: boolean }) {
  const content = (
    <>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </CardContent>
    </>
  );

  if (!showCard) {
    return <div className="flex flex-col">{content}</div>;
  }

  return <Card>{content}</Card>;
}
