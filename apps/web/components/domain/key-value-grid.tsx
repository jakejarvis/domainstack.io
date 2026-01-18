import { cn } from "@/lib/utils";

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
  // Tailwind requires static class names; map numeric props to explicit classes
  const baseClassMap: Record<1 | 2 | 3, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
  };
  const desktopClassMap: Record<1 | 2 | 3, string> = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
  };

  const mobileClass = baseClassMap[colsMobile];
  const desktopClass = colsDesktop ? desktopClassMap[colsDesktop] : undefined;
  return (
    <div className={cn("grid gap-2", mobileClass, desktopClass, className)}>
      {children}
    </div>
  );
}
