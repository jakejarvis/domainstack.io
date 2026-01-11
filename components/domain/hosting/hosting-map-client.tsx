"use client";

import { Favicon } from "@/components/icons/favicon";
import {
  MapControls,
  MapInstance,
  MapMarker,
  MapMarkerContent,
  MapMarkerLabel,
} from "@/components/ui/map";

interface HostingMapClientProps {
  lat: number;
  lon: number;
  domain?: string;
}

export function HostingMapClient({ lat, lon, domain }: HostingMapClientProps) {
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
            <div className="relative size-4 rounded-full bg-gradient-to-b from-accent-cyan to-accent-blue shadow-lg" />
          </div>
          {domain && (
            <MapMarkerLabel position="bottom">
              <div className="mt-1.5 flex items-center gap-1 leading-none">
                <Favicon domain={domain} className="size-3 shrink-0 rounded" />
                {domain}
              </div>
            </MapMarkerLabel>
          )}
        </MapMarkerContent>
      </MapMarker>
      <MapControls position="top-right" showZoom showCompass />
    </MapInstance>
  );
}
