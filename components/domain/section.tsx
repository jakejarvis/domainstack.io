import { AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/tappable-tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  help,
  icon,
  slug,
  accent = "slate",
  isLoading,
  isError,
  children,
}: {
  title: string;
  description?: string;
  help?: string;
  icon?: React.ElementType;
  slug?: string;
  accent?: "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "slate";
  isLoading?: boolean;
  isError?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = icon;
  // Loading/Error adornments reflect props only; avoid client-only hydration gates
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
      <Card
        className="relative overflow-hidden rounded-3xl border border-black/10 bg-background/60 py-0 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/10"
        data-accent={accent}
      >
        {/* Accent glow */}
        <div
          aria-hidden
          className={cn(
            "-inset-x-8 -top-8 pointer-events-none absolute h-24 opacity-30 blur-2xl",
            "accent-glow",
          )}
        />
        <div className="relative">
          <div className="p-5" id={headerId}>
            <div className="flex w-full items-center gap-3 text-left">
              {Icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/80">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-base">{title}</span>
                  {help && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            role="img"
                            aria-label={`More info about ${title}`}
                          >
                            <Info
                              className="h-3.5 w-3.5 opacity-60"
                              aria-hidden
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">{help}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </CardTitle>
                {(description || help) && (
                  <CardDescription className="sr-only">
                    {description}
                  </CardDescription>
                )}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="mr-2 flex items-center gap-2 text-muted-foreground text-xs">
                  {isLoading && (
                    <>
                      <Spinner className="size-5" />
                      <span className="sr-only">Loading</span>
                    </>
                  )}
                  {isError && (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 stroke-destructive" />
                      <span>Error</span>
                    </>
                  )}
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
