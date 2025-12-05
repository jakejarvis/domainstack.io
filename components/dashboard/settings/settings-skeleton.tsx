"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SettingsSkeletonProps {
  /** Whether to show the card wrapper with visual styling */
  showCard?: boolean;
}

/**
 * Loading skeleton for settings content.
 * Always renders a Card for proper semantic structure,
 * but applies minimal styling when showCard is false.
 */
export function SettingsSkeleton({ showCard = true }: SettingsSkeletonProps) {
  return (
    <Card
      className={cn(!showCard && "border-0 bg-transparent py-0 shadow-none")}
    >
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </CardContent>
    </Card>
  );
}
