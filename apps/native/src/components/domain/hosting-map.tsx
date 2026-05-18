import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform, View } from "react-native";
import { useCSSVariable } from "uniwind";

const MAP_HEIGHT = 240;
const ZOOM = 4;

export function HostingMap({ lat, lon, domain }: { lat: number; lon: number; domain?: string }) {
  const brand = useCSSVariable("--color-brand") as string;
  const cameraPosition = {
    coordinates: { latitude: lat, longitude: lon },
    zoom: ZOOM,
  } as const;

  if (Platform.OS === "ios") {
    return (
      <View
        className="overflow-hidden rounded-xl border border-border"
        style={{ height: MAP_HEIGHT }}
      >
        <AppleMaps.View
          style={{ flex: 1 }}
          cameraPosition={cameraPosition}
          colorScheme={AppleMaps.MapColorScheme.AUTOMATIC}
          properties={{ selectionEnabled: false }}
          uiSettings={{
            compassEnabled: false,
            myLocationButtonEnabled: false,
            scaleBarEnabled: false,
            togglePitchEnabled: false,
          }}
          markers={[
            {
              id: "host",
              coordinates: { latitude: lat, longitude: lon },
              title: domain,
              tintColor: brand,
              systemImage: "globe",
            },
          ]}
        />
      </View>
    );
  }

  if (Platform.OS === "android") {
    return (
      <View
        className="overflow-hidden rounded-xl border border-border"
        style={{ height: MAP_HEIGHT }}
      >
        <GoogleMaps.View
          style={{ flex: 1 }}
          cameraPosition={cameraPosition}
          colorScheme={GoogleMaps.MapColorScheme.FOLLOW_SYSTEM}
          properties={{
            selectionEnabled: false,
            isBuildingEnabled: false,
            isTrafficEnabled: false,
            minZoomPreference: 2,
            maxZoomPreference: 10,
          }}
          uiSettings={{
            compassEnabled: false,
            mapToolbarEnabled: false,
            myLocationButtonEnabled: false,
            rotationGesturesEnabled: false,
            tiltGesturesEnabled: false,
            zoomControlsEnabled: false,
            scaleBarEnabled: false,
          }}
          markers={[
            {
              id: "host",
              coordinates: { latitude: lat, longitude: lon },
              title: domain,
              showCallout: Boolean(domain),
            },
          ]}
        />
      </View>
    );
  }

  return null;
}
