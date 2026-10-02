/** "auto" when the user prefers reduced motion, else "smooth". Call at event time, not render. */
export function preferredScrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
