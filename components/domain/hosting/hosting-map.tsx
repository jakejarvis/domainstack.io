"use client";

import { memo } from "react";
import MapboxMap, { Marker, NavigationControl } from "react-map-gl/mapbox";
import type { Hosting } from "@/lib/schemas";

function MapInner({ hosting }: { hosting: Hosting }) {
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;

  const lat = hosting.geo.lat;
  const lon = hosting.geo.lon;

  if (lat == null || lon == null) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-background/40 p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/10">
      <MapboxMap
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: lon, latitude: lat, zoom: 4 }}
        boxZoom={false}
        doubleClickZoom={false}
        dragRotate={false}
        keyboard={false}
        scrollZoom={false}
        touchPitch={false}
        touchZoomRotate={false}
        style={{ height: 280, width: "100%" }}
        mapStyle="mapbox://styles/mapbox/standard"
        reuseMaps
      >
        <Marker longitude={lon} latitude={lat}>
          <div className="h-4 w-4 rounded-full bg-blue-600 shadow-2xl ring-2 ring-white" />
        </Marker>
        <NavigationControl />
      </MapboxMap>
    </div>
  );
}

export const HostingMap = memo(MapInner, (prev, next) => {
  const p = prev.hosting.geo;
  const n = next.hosting.geo;
  return p.lat === n.lat && p.lon === n.lon;
});
