"use client";

import { useEffect } from "react";
import { LAYOUT_CSS_VARIABLES } from "@/lib/constants";

/**
 * Injects layout CSS variables onto the document root.
 * Should be called once on client-side mount.
 */
function injectLayoutCSSVariables(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const [name, value] of Object.entries(LAYOUT_CSS_VARIABLES)) {
    root.style.setProperty(name, value);
  }
}

/**
 * Hook that injects layout CSS variables onto the document root.
 *
 * This enables a single source of truth for layout dimensions in JS constants,
 * while still allowing Tailwind classes to use CSS variables.
 *
 * Tailwind classes should include fallback values for SSR:
 * `h-[var(--header-height,80px)]` instead of `h-[var(--header-height)]`
 *
 * @example
 * // In app/providers.tsx or root layout
 * function Providers({ children }) {
 *   useLayoutCSSVariables();
 *   return <>{children}</>;
 * }
 */
export function useLayoutCSSVariables(): void {
  useEffect(() => {
    injectLayoutCSSVariables();
  }, []);
}
