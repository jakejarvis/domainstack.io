import { useMediaQuery } from "./use-media-query";

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
  // Default hover to true so SSR matches desktop (the common case).
  // `(hover: hover)` defaulting to false made every consumer treat the
  // server render as a touch device and swap Popover ↔ Tooltip on hydrate.
  const supportsHover = useMediaQuery("(hover: hover)", true);
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");

  return {
    supportsHover,
    isCoarsePointer,
    isTouchDevice: !supportsHover || isCoarsePointer,
  };
}
