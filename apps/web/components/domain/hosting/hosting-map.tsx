"use client";

import dynamic from "next/dynamic";

import { HostingMapSkeleton } from "@/components/domain/hosting/hosting-map-skeleton";
import { useIsClient } from "@/hooks/use-is-client";

const HostingMapClient = dynamic(
  () => import("@/components/domain/hosting/hosting-map-client").then((m) => m.HostingMapClient),
  {
    ssr: false,
    loading: () => <HostingMapSkeleton />,
  },
);

/**
 * Keep the map off the server HTML and the first client paint.
 * `next/dynamic` with `ssr: false` still hydrates the real module when the
 * chunk is already available, which mismatches the server skeleton.
 */
export function HostingMap({ lat, lon, domain }: { lat: number; lon: number; domain?: string }) {
  const mounted = useIsClient();

  if (!mounted) {
    return <HostingMapSkeleton />;
  }

  return <HostingMapClient lat={lat} lon={lon} domain={domain} />;
}
