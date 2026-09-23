import { IconInfoCircle } from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardTitle } from "@domainstack/ui/card";
import { Icon } from "@domainstack/ui/icon";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const GLOW_CLASSES = {
  blue: "glow-accent-blue/15",
  purple: "glow-accent-purple/15",
  green: "glow-accent-green/15",
  orange: "glow-accent-orange/15",
  pink: "glow-accent-pink/15",
  cyan: "glow-accent-cyan/15",
  slate: "glow-accent-slate/15",
};

interface ReportSectionProps {
  title: string;
  description?: string;
  help?: string;
  icon?: React.ElementType;
  slug?: string;
  accent?: keyof typeof GLOW_CLASSES;
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
  const IconComponent = icon;
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
      className="scroll-mt-[calc(var(--section-nav-height)+var(--scroll-padding))] border-none md:scroll-mt-[calc(var(--header-height)+var(--section-nav-height)+var(--scroll-padding))]"
    >
      <Card className="relative gap-0 overflow-hidden py-0">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-x-20 -top-20 h-52",
            GLOW_CLASSES[accent],
          )}
        />
        <div className="relative">
          <div className="p-6" id={headerId}>
            <div className="flex w-full items-center gap-2 text-left">
              {IconComponent && (
                <Icon size="sm" className="rounded-full">
                  <IconComponent />
                </Icon>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-base">{title}</span>
                  {help && (
                    <ResponsiveTooltip>
                      <ResponsiveTooltipTrigger
                        nativeButton={false}
                        render={
                          <span role="img" aria-label={`More info about ${title}`}>
                            <IconInfoCircle className="size-3.5 opacity-60" aria-hidden />
                          </span>
                        }
                      />
                      <ResponsiveTooltipContent>{help}</ResponsiveTooltipContent>
                    </ResponsiveTooltip>
                  )}
                </CardTitle>
                {(description || help) && (
                  <CardDescription className="sr-only">{description}</CardDescription>
                )}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {isLoading && (
                  <div className="mr-2 flex items-center gap-2 text-xs text-muted-foreground">
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
            <CardContent className="space-y-2 pb-6">{children}</CardContent>
          </div>
        )}
      </Card>
    </section>
  );
}
