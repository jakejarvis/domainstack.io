import { cn } from "@domainstack/ui/utils";

// Tailwind requires static class names; map numeric props to explicit classes
const BASE_CLASS_MAP: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};
const DESKTOP_CLASS_MAP: Record<1 | 2 | 3, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

export function KeyValueGrid({
  children,
  className,
  colsMobile = 1,
  colsDesktop,
}: {
  children: React.ReactNode;
  className?: string;
  colsMobile?: 1 | 2 | 3;
  colsDesktop?: 1 | 2 | 3;
}) {
  const mobileClass = BASE_CLASS_MAP[colsMobile];
  const desktopClass = colsDesktop ? DESKTOP_CLASS_MAP[colsDesktop] : undefined;
  return <div className={cn("grid gap-2", mobileClass, desktopClass, className)}>{children}</div>;
}
