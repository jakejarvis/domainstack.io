import { startTransition, useCallback, useEffect, useRef, useState } from "react";

export function useTruncation() {
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const recalcTruncation = useCallback(() => {
    const element = valueRef.current;
    if (!element) return;
    startTransition(() => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    });
  }, []);

  useEffect(() => {
    const element = valueRef.current;
    if (!element) return;

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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", scheduleRecalc);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, [recalcTruncation]);

  return {
    valueRef,
    isTruncated,
  };
}
