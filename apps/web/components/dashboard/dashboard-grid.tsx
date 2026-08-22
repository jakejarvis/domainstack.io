import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { DashboardGridCard } from "@/components/dashboard/dashboard-grid-card";
import { GridUpgradeCard } from "@/components/dashboard/grid-upgrade-card";
import type { TrackedDomainWithDetails } from "@domainstack/types";

type DashboardGridProps = {
  domains: TrackedDomainWithDetails[];
};

function createInitialDelays(domains: TrackedDomainWithDetails[]) {
  const delays = new Map<string, number>();
  domains.forEach((domain, index) => {
    delays.set(domain.id, Math.min(index * 0.05, 0.3));
  });
  delays.set("upgrade-cta", Math.min(domains.length * 0.05, 0.3));
  return delays;
}

function pruneDelays(delays: Map<string, number>, domains: TrackedDomainWithDetails[]) {
  const visible = new Set(domains.map((domain) => domain.id));
  visible.add("upgrade-cta");

  let changed = false;
  const next = new Map<string, number>();
  for (const [id, delay] of delays) {
    if (visible.has(id)) {
      next.set(id, delay);
    } else {
      changed = true;
    }
  }
  return changed ? next : delays;
}

export function DashboardGrid({ domains }: DashboardGridProps) {
  const shouldReduceMotion = useReducedMotion();

  // First-paint stagger only. Drop delays for ids that have left so a later
  // remount (filter clear) enters instantly instead of replaying.
  const [initialDelays, setInitialDelays] = useState(() => createInitialDelays(domains));
  const delays = pruneDelays(initialDelays, domains);
  if (delays !== initialDelays) {
    setInitialDelays(delays);
  }

  const ease = [0.22, 1, 0.36, 1] as const;
  const duration = shouldReduceMotion ? 0.1 : 0.18;
  const layoutTransition = { duration, ease } as const;

  const getItemMotionProps = (id: string) => {
    const delay = shouldReduceMotion ? 0 : (delays.get(id) ?? 0);

    return {
      layout: shouldReduceMotion ? false : ("position" as const),
      initial: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: shouldReduceMotion ? 0 : -10 },
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
      <AnimatePresence>
        {domains.map((domain) => (
          <motion.div key={domain.id} className="h-full" {...getItemMotionProps(domain.id)}>
            <DashboardGridCard domain={domain} />
          </motion.div>
        ))}

        {/* Free-tier CTA: treated as just another (last) grid item */}
        <motion.div key="upgrade-cta" className="h-full" {...getItemMotionProps("upgrade-cta")}>
          <GridUpgradeCard />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
