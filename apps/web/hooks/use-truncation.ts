import { useCallback, useEffect, useRef, useState } from "react";

export function useTruncation() {
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const recalcTruncation = useCallback(() => {
    const element = valueRef.current;
    if (!element) return;
    setIsTruncated(element.scrollWidth > element.clientWidth);
  }, []);

  useEffect(() => {
    const element = valueRef.current;
    if (!element) return;

    // Initial check after layout
    const raf = requestAnimationFrame(recalcTruncation);

    // Observe size changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => recalcTruncation());
      resizeObserver.observe(element);
    }

    // Observe text/content changes
    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => recalcTruncation());
      mutationObserver.observe(element, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    }

    // Also listen for window resizes
    window.addEventListener("resize", recalcTruncation);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", recalcTruncation);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, [recalcTruncation]);

  return {
    valueRef,
    isTruncated,
  };
}
