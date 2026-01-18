import { useEffect, useRef, useState } from "react";

export function useProgressiveReveal<T>(items: T[], initialVisible: number) {
  const [visible, setVisible] = useState(initialVisible);
  const total = items.length;
  const more = total - visible;
  const prevVisibleRef = useRef(visible);
  const prev = Math.min(prevVisibleRef.current, visible);
  const existing = items.slice(0, prev);
  const added = items.slice(prev, Math.min(visible, total));

  useEffect(() => {
    prevVisibleRef.current = Math.min(visible, items.length);
  }, [visible, items]);

  return { existing, added, more, total, visible, setVisible } as const;
}
