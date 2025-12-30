"use client";

import { useEffect, useState } from "react";
import MapboxMap, { Marker, NavigationControl } from "react-map-gl/mapbox";

interface HostingMapClientProps {
  lat: number;
  lon: number;
  mountKey: string;
}

export function HostingMapClient({
  lat,
  lon,
  mountKey,
}: HostingMapClientProps) {
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Reset map loaded state when component unmounts
  useEffect(() => {
    return () => {
      setIsMapLoaded(false);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/65 bg-background/40 p-0 backdrop-blur-lg dark:border-border/50">
      <MapboxMap
        key={mountKey}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: lon, latitude: lat, zoom: 4 }}
        boxZoom={false}
        doubleClickZoom={false}
        dragRotate={false}
        keyboard={false}
        scrollZoom={false}
        touchPitch={false}
        touchZoomRotate={false}
        onLoad={() => setIsMapLoaded(true)}
        style={{ height: 280, width: "100%" }}
        mapStyle="mapbox://styles/mapbox/standard"
      >
        {isMapLoaded && (
          <>
            <Marker longitude={lon} latitude={lat}>
              <div className="h-4 w-4 rounded-full bg-blue-600 shadow-2xl ring-2 ring-white" />
            </Marker>
            <NavigationControl />
          </>
        )}
      </MapboxMap>
    </div>
  );
}
