import { startTransition, useCallback, useRef, useState } from "react";

export function useTruncation() {
  const [isTruncated, setIsTruncated] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // A callback ref, so observers follow the element even when the caller swaps
  // it (e.g. ProviderCell wrapping the value in a tooltip trigger once truncated).
  const valueRef = useCallback((element: HTMLSpanElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!element) return;

    const recalcTruncation = () => {
      startTransition(() => {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      });
    };

    // Defer measurement to the next frame so ResizeObserver callbacks do not
    // mutate layout in the same delivery loop (Firefox reports that as an error).
    let raf = 0;
    const scheduleRecalc = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalcTruncation);
    };

    scheduleRecalc();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleRecalc);
      resizeObserver.observe(element);
    }

    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(scheduleRecalc);
      mutationObserver.observe(element, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    }

    window.addEventListener("resize", scheduleRecalc);

    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", scheduleRecalc);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, []);

  return {
    valueRef,
    isTruncated,
  };
}
