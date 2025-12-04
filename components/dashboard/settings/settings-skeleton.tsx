"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsSkeletonProps {
  /** Whether to show the card wrapper */
  showCard?: boolean;
}

/**
 * Loading skeleton for settings content.
 */
export function SettingsSkeleton({ showCard = true }: SettingsSkeletonProps) {
  const content = (
    <>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 rounded-lg" />
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
