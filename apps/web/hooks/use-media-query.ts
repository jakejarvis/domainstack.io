import { useSyncExternalStore } from "react";

/**
 * Custom hook that subscribes to a media query and returns whether it matches.
 *
 * Uses `useSyncExternalStore` for optimal React 18+ compatibility, including:
 * - Proper concurrent rendering support
 * - Automatic SSR/hydration handling
 * - Efficient subscriptions and cleanup
 *
 * @param query - The media query string to match (e.g., "(min-width: 768px)")
 * @param defaultValue - The default value to return during SSR (default: false)
 *
 * @returns Boolean indicating whether the media query matches
 *
 * @example
 * ```tsx
 * // Check if screen is mobile
 * const isMobile = useMediaQuery("(max-width: 767px)");
 *
 * // Check for dark mode preference
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 *
 * // Check for hover capability
 * const canHover = useMediaQuery("(hover: hover)");
 *
 * // With custom default for SSR
 * const isDesktop = useMediaQuery("(min-width: 1024px)", true);
 * ```
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (callback) => {
      // Return early if matchMedia is not available (old browsers)
      if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
      ) {
        return () => {};
      }

      const mediaQueryList = window.matchMedia(query);

      // Subscribe to changes
      mediaQueryList.addEventListener("change", callback);

      // Return cleanup function
      return () => {
        mediaQueryList.removeEventListener("change", callback);
      };
    },
    () => {
      // Get current client-side value
      if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
      ) {
        return defaultValue;
      }

      return window.matchMedia(query).matches;
    },
    () => {
      // Get server-side snapshot (always returns defaultValue to avoid hydration mismatch)
      return defaultValue;
    },
  );
}
