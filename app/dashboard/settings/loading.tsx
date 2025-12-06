import { SettingsSkeleton } from "@/components/dashboard/settings";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>

      {/* Settings content skeleton */}
      <SettingsSkeleton />
    </div>
  );
}
