import { Badge } from "@domainstack/ui/badge";
import { Button } from "@domainstack/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@domainstack/ui/collapsible";
import { cn } from "@domainstack/ui/utils";
import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DashboardTableColumnMenu } from "@/components/dashboard/dashboard-table-column-menu";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

type MobileFiltersCollapsibleProps = {
  hasActiveFilters: boolean;
  activeFilterCount: number;
  // biome-ignore lint/suspicious/noExplicitAny: Table generic type varies
  table?: Table<any> | null;
  children: React.ReactNode;
};

export function MobileFiltersCollapsible({
  hasActiveFilters,
  activeFilterCount,
  table,
  children,
}: MobileFiltersCollapsibleProps) {
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const shouldReduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger
          render={
            <Button variant="outline" className="flex-1 justify-between">
              <span className="flex items-center gap-2">
                <IconFilter className="text-muted-foreground" />
                <span className="text-sm">Filters</span>
                <AnimatePresence initial={false}>
                  {hasActiveFilters && (
                    <motion.span
                      initial={{
                        opacity: 0,
                        scale: shouldReduceMotion ? 1 : 0.9,
                      }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
                      transition={{
                        duration: shouldReduceMotion ? 0.1 : 0.16,
                        ease: [0.22, 1, 0.36, 1] as const,
                      }}
                      className="ml-1 inline-flex"
                    >
                      <Badge variant="secondary">{activeFilterCount}</Badge>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <IconChevronDown
                className={cn(
                  "transition-transform",
                  mobileOpen && "rotate-180",
                )}
              />
            </Button>
          }
        />

        {/* Column visibility - always visible in collapsed mode for table view */}
        {viewMode === "table" && table && (
          <DashboardTableColumnMenu table={table} />
        )}
      </div>

      <CollapsibleContent
        keepMounted
        render={(contentProps) => {
          const { children: contentChildren, ...rest } = contentProps;
          return (
            <div {...rest}>
              <motion.div
                initial={false}
                animate={
                  mobileOpen
                    ? { height: "auto", opacity: 1 }
                    : { height: shouldReduceMotion ? "auto" : 0, opacity: 0 }
                }
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.22,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
                style={{ overflow: shouldReduceMotion ? undefined : "hidden" }}
              >
                {contentChildren}
              </motion.div>
            </div>
          );
        }}
      >
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
