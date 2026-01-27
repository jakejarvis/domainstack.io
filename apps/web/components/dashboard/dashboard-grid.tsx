import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { DashboardGridCard } from "@/components/dashboard/dashboard-grid-card";
import { GridUpgradeCard } from "@/components/dashboard/grid-upgrade-card";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

type DashboardGridProps = {
  domains: TrackedDomainWithDetails[];
};

export function DashboardGrid({ domains }: DashboardGridProps) {
  const shouldReduceMotion = useReducedMotion();

  // Stagger on first mount only (keeps later add/remove snappy and avoids re-staggering on sort/filter).
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    isFirstMountRef.current = false;
  }, []);

  const ease = [0.22, 1, 0.36, 1] as const;
  const duration = shouldReduceMotion ? 0.1 : 0.18;
  const layoutTransition = { duration, ease } as const;

  const getItemMotionProps = (index: number) => {
    const delay =
      isFirstMountRef.current && !shouldReduceMotion
        ? Math.min(index * 0.05, 0.3)
        : 0;

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
        {domains.map((domain, index) => (
          <motion.div
            key={domain.id}
            className="h-full"
            {...getItemMotionProps(index)}
          >
            <DashboardGridCard
              trackedDomainId={domain.id}
              domainId={domain.domainId}
              domainName={domain.domainName}
              verified={domain.verified}
              verificationStatus={domain.verificationStatus}
              verificationMethod={domain.verificationMethod}
              verificationFailedAt={domain.verificationFailedAt}
              expirationDate={domain.expirationDate}
              registrar={domain.registrar}
              dns={domain.dns}
              hosting={domain.hosting}
              email={domain.email}
              ca={domain.ca}
              muted={domain.muted}
            />
          </motion.div>
        ))}

        {/* Free-tier CTA: treated as just another (last) grid item */}
        <motion.div
          key="upgrade-cta"
          className="h-full"
          {...getItemMotionProps(domains.length)}
        >
          <GridUpgradeCard />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
