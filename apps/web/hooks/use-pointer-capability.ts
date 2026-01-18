import { useMediaQuery } from "@/hooks/use-media-query";

interface PointerCapability {
  supportsHover: boolean;
  isCoarsePointer: boolean;
  isTouchDevice: boolean;
}

/**
 * React hook that reports the current pointer/hover capability of the device.
 *
 * @returns Object containing:
 * - supportsHover: true when the primary input can meaningfully hover (e.g., mouse)
 * - isCoarsePointer: true when the primary pointer is coarse (e.g., touch)
 * - isTouchDevice: convenience property, true when device is primarily touch-based
 */
export function usePointerCapability(): PointerCapability {
  const supportsHover = useMediaQuery("(hover: hover)");
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");

  return {
    supportsHover,
    isCoarsePointer,
    isTouchDevice: !supportsHover || isCoarsePointer,
  };
}
