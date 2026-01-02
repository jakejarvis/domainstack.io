"use client";

import {
  MapControls,
  MapInstance,
  MapMarker,
  MapMarkerContent,
} from "@/components/ui/map";

interface HostingMapClientProps {
  lat: number;
  lon: number;
}

export function HostingMapClient({ lat, lon }: HostingMapClientProps) {
  return (
    <MapInstance
      center={[lon, lat]}
      zoom={4}
      minZoom={2}
      maxZoom={10} // don't pretend that geolocation is accurate ;)
      dragRotate={false}
      keyboard={false}
      scrollZoom={false}
      touchPitch={false}
      touchZoomRotate={false}
      className="rounded-2xl border border-border/65 bg-muted/20 backdrop-blur-lg dark:border-border/50"
    >
      <MapMarker longitude={lon} latitude={lat}>
        <MapMarkerContent>
          <div className="relative">
            <div className="absolute -inset-2 not-motion-safe:hidden animate-ping rounded-full bg-accent-cyan/30 [animation-duration:2s]" />
            <div className="absolute -inset-1 rounded-full bg-accent-cyan/20 blur-sm" />
            <div className="relative flex size-4 items-center justify-center rounded-full bg-gradient-to-b from-accent-cyan to-accent-blue shadow-lg ring-2 ring-white dark:ring-background/40">
              <div className="size-2 rounded-full bg-white/90 dark:bg-white/75" />
            </div>
          </div>
        </MapMarkerContent>
      </MapMarker>
      <MapControls position="top-right" showZoom showCompass />
    </MapInstance>
  );
}
