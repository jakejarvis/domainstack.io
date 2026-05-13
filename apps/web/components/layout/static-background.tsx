"use client";

import { createPortal } from "react-dom";

import { useIsHydrated } from "@/hooks/use-is-hydrated";

export function StaticBackground() {
  const mounted = useIsHydrated();

  if (!mounted) return null;

  return createPortal(
    <div
      data-slot="portal-background"
      className="pointer-events-none absolute top-0 left-0 -z-10 h-full w-full overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/3 via-transparent to-accent-purple/3" />
      <div className="absolute top-0 right-1/4 size-[500px] rounded-full bg-accent-blue/5 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 size-[500px] rounded-full bg-accent-purple/5 blur-3xl" />
    </div>,
    document.body,
  );
}
