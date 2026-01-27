import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@domainstack/ui/card";
import { Spinner } from "@domainstack/ui/spinner";
import { IconInfoCircle } from "@tabler/icons-react";

interface ReportSectionSkeletonProps {
  title: string;
  description?: string;
  help?: string;
  icon?: React.ElementType;
  slug?: string;
  accent?: "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "slate";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ReportSectionSkeleton({
  title,
  description,
  help,
  icon,
  slug,
  accent = "slate",
  children,
}: ReportSectionSkeletonProps) {
  const Icon = icon;
  // Loading adornment reflects props only; avoid client-only hydration gates
  const computedSlug = (slug ?? title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const headerId = `section-header-${computedSlug}`;
  const contentId = `section-content-${computedSlug}`;
  return (
    <section
      id={computedSlug}
      aria-labelledby={headerId}
      className="border-none"
    >
      <Card className="relative gap-0 overflow-hidden rounded-xl border border-black/10 bg-background/60 py-0 shadow-2xl shadow-black/10 dark:border-white/10">
        {/* Accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-8 h-24 accent-glow opacity-30 blur-2xl"
          style={
            { "--glow-color": `var(--accent-${accent})` } as React.CSSProperties
          }
        />
        <div className="relative">
          <div className="p-5" id={headerId}>
            <div className="flex w-full items-center gap-3 text-left">
              {Icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground/90">
                  <Icon className="size-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-base">{title}</span>
                  <span role="img">
                    <IconInfoCircle
                      className="size-3.5 opacity-60"
                      aria-hidden
                    />
                  </span>
                </CardTitle>
                {(description || help) && (
                  <CardDescription className="sr-only">
                    {description}
                  </CardDescription>
                )}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="mr-2 flex items-center gap-2 text-muted-foreground text-xs">
                  <Spinner className="size-5" />
                  <span className="sr-only">Loading</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {children && (
          <div id={contentId}>
            <CardContent className="space-y-2 px-5 pt-0 pb-5">
              {children}
            </CardContent>
          </div>
        )}
      </Card>
    </section>
  );
}
