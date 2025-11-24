"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { HostingMapSkeleton } from "@/components/domain/hosting/hosting-map-skeleton";
import type { HostingResponse } from "@/lib/schemas";

interface HostingMapClientProps {
  lat: number;
  lon: number;
  mountKey: string;
}

// Dynamically import the map component with no SSR to prevent hydration/navigation issues
const MapboxMapClient = dynamic<HostingMapClientProps>(
  () => import("./hosting-map-client").then((mod) => mod.HostingMapClient),
  {
    ssr: false,
    loading: () => <HostingMapSkeleton />,
  },
);

export function HostingMap({ hosting }: { hosting: HostingResponse }) {
  // Generate unique key on mount to force full remount on navigation
  const [mountKey] = useState(() => `map-${Date.now()}-${Math.random()}`);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;

  const lat = hosting.geo.lat;
  const lon = hosting.geo.lon;

  if (lat == null || lon == null) return null;

  return <MapboxMapClient mountKey={mountKey} lat={lat} lon={lon} />;
}
