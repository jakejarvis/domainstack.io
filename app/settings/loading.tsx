import {
  SettingsSkeletonPanels,
  SettingsSkeletonTabsList,
} from "@/components/settings/settings-skeleton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-5">
      {/* Page header skeleton */}
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>

      {/* Settings content skeleton */}
      <Card className="overflow-hidden p-0">
        <div className="w-full space-y-6 px-6">
          <SettingsSkeletonTabsList className="mt-6" />
          <SettingsSkeletonPanels className="mb-4" />
        </div>
      </Card>
    </div>
  );
}
