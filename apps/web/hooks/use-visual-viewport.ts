import { useEffect, useState } from "react";

interface VisualViewportState {
  /** Current visual viewport height in pixels */
  height: number;
  /** Difference between window height and visual viewport (keyboard height estimate) */
  keyboardHeight: number;
  /** Whether the keyboard appears to be open (viewport significantly smaller than window) */
  isKeyboardOpen: boolean;
}

/**
 * Track the visual viewport size to detect virtual keyboard presence.
 *
 * On iOS Safari, when the keyboard opens, the layout viewport stays the same
 * but the visual viewport shrinks. This hook detects that difference.
 *
 * @param threshold - Minimum height difference (in px) to consider keyboard "open". Default 150.
 */
export function useVisualViewport(threshold = 150): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    keyboardHeight: 0,
    isKeyboardOpen: false,
  }));

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      // VisualViewport API not supported, fall back to window dimensions
      return;
    }

    function update() {
      if (!viewport) return;

      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight);
      const isKeyboardOpen = keyboardHeight > threshold;

      setState({
        height: viewportHeight,
        keyboardHeight,
        isKeyboardOpen,
      });
    }

    // Initial update
    update();

    // Listen for viewport changes (resize, scroll due to keyboard)
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [threshold]);

  return state;
}
