import { InfoIcon } from "@phosphor-icons/react/ssr";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ReportSectionProps {
  title: string;
  description?: string;
  help?: string;
  icon?: React.ElementType;
  slug?: string;
  accent?: "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "slate";
  isLoading?: boolean;
  /** Optional actions to render in the top-right of the section header */
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}

export function ReportSection({
  title,
  description,
  help,
  icon,
  slug,
  accent = "slate",
  isLoading,
  headerActions,
  children,
}: ReportSectionProps) {
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
      // scroll-mt accounts for sticky headers: mobile (sub-nav only) / desktop (global + sub-nav)
      className="scroll-mt-[calc(var(--section-nav-height,48px)+var(--scroll-padding,16px))] border-none md:scroll-mt-[calc(var(--header-height,72px)+var(--section-nav-height,48px)+var(--scroll-padding,16px))]"
    >
      <Card
        className="relative gap-0 overflow-hidden rounded-3xl border border-black/10 bg-background/60 py-0 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/10"
        data-accent={accent}
      >
        {/* Accent glow */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-x-8 -top-8 h-24 opacity-30 blur-2xl",
            "accent-glow",
          )}
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
                  {help && (
                    <ResponsiveTooltip>
                      <ResponsiveTooltipTrigger
                        nativeButton={false}
                        render={
                          <span
                            role="img"
                            aria-label={`More info about ${title}`}
                          >
                            <InfoIcon
                              className="size-3.5 opacity-60"
                              aria-hidden
                            />
                          </span>
                        }
                      />
                      <ResponsiveTooltipContent>
                        {help}
                      </ResponsiveTooltipContent>
                    </ResponsiveTooltip>
                  )}
                </CardTitle>
                {(description || help) && (
                  <CardDescription className="sr-only">
                    {description}
                  </CardDescription>
                )}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {isLoading && (
                  <div className="mr-2 flex items-center gap-2 text-muted-foreground text-xs">
                    <Spinner className="size-5" />
                    <span className="sr-only">Loading</span>
                  </div>
                )}
                {headerActions}
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
