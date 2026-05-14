import { Image } from "expo-image";
import { Platform } from "react-native";

const MAX_DISK_BYTES = 192 * 1024 * 1024;
const MAX_MEMORY_BYTES = 48 * 1024 * 1024;

/**
 * Bound expo-image's native cache. iOS-only — Android's Glide manages its own
 * disk/memory caches via LRU and isn't tunable from JS without a native module.
 */
export function configureImageCache(): void {
  if (Platform.OS !== "ios") return;
  Image.configureCache({
    maxDiskSize: MAX_DISK_BYTES,
    maxMemoryCost: MAX_MEMORY_BYTES,
  });
}
