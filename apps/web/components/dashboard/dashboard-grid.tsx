import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";

import { DashboardGridCard } from "@/components/dashboard/dashboard-grid-card";
import { GridUpgradeCard } from "@/components/dashboard/grid-upgrade-card";
import type { TrackedDomainWithDetails } from "@domainstack/types";

type DashboardGridProps = {
  domains: TrackedDomainWithDetails[];
};

export function DashboardGrid({ domains }: DashboardGridProps) {
  const shouldReduceMotion = useReducedMotion();

  // Capture visual-order delays on this grid's first mount.
  const [enterDelays] = useState(() => {
    const delays = new Map<string, number>();
    domains.forEach((domain, index) => {
      delays.set(domain.id, Math.min(index * 0.05, 0.3));
    });
    delays.set("upgrade-cta", Math.min(domains.length * 0.05, 0.3));
    return delays;
  });

  const ease = [0.22, 1, 0.36, 1] as const;
  const duration = shouldReduceMotion ? 0.1 : 0.18;
  const layoutTransition = { duration, ease } as const;

  const getItemMotionProps = (id: string) => {
    const delay = shouldReduceMotion ? 0 : (enterDelays.get(id) ?? 0);

    return {
      layout: shouldReduceMotion ? false : ("position" as const),
      initial: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
      animate: { opacity: 1, y: 0 },
      exit: {
        opacity: 0,
        y: shouldReduceMotion ? 0 : -10,
        transition: {
          opacity: { duration, ease, delay: 0 },
          y: { duration, ease, delay: 0 },
        },
      },
      transition: {
        // Stagger only the "enter" fade/slide; never delay layout reflow.
        opacity: { duration, ease, delay },
        y: { duration, ease, delay },
        layout: layoutTransition,
      },
    };
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {domains.map((domain) => (
          <m.div key={domain.id} className="h-full" {...getItemMotionProps(domain.id)}>
            <DashboardGridCard domain={domain} />
          </m.div>
        ))}

        <m.div key="upgrade-cta" className="h-full" {...getItemMotionProps("upgrade-cta")}>
          <GridUpgradeCard />
        </m.div>
      </AnimatePresence>
    </div>
  );
}
