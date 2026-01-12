/**
 * Layout dimension constants for sticky headers and scroll behavior.
 *
 * These are the single source of truth for layout dimensions.
 * CSS variables are injected at runtime via useLayoutCSSVariables hook.
 * Tailwind classes use fallback values for SSR: var(--header-height, 72px)
 */

/** Global app header height in pixels */
export const HEADER_HEIGHT = 72;

/** Section navigation bar height in pixels */
export const SECTION_NAV_HEIGHT = 48;

/** Extra breathing room when scrolling to sections in pixels */
export const SCROLL_PADDING = 16;

/**
 * CSS variable definitions for layout dimensions.
 * Used by useLayoutCSSVariables to inject at runtime.
 */
export const LAYOUT_CSS_VARIABLES = {
  "--header-height": `${HEADER_HEIGHT}px`,
  "--section-nav-height": `${SECTION_NAV_HEIGHT}px`,
  "--scroll-padding": `${SCROLL_PADDING}px`,
} as const;
