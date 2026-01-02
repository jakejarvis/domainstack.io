import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { SelectableDomainCard } from "@/components/dashboard/selectable-domain-card";
import { UpgradeCard } from "@/components/dashboard/upgrade-card";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

type TrackedDomainsGridProps = {
  domains: TrackedDomainWithDetails[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
  isPro: boolean;
  proMaxDomains: number;
};

export function TrackedDomainsGrid({
  domains,
  selectedIds = new Set(),
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
  isPro,
  proMaxDomains,
}: TrackedDomainsGridProps) {
  // Stagger on first mount only (keeps later add/remove snappy and avoids re-staggering on sort/filter).
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    isFirstMountRef.current = false;
  }, []);

  const ease = [0.22, 1, 0.36, 1] as const;
  const duration = 0.18;
  const layoutTransition = { duration, ease } as const;

  const getItemMotionProps = (index: number) => {
    const delay = isFirstMountRef.current ? Math.min(index * 0.05, 0.3) : 0;

    return {
      layout: "position" as const,
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
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
            <SelectableDomainCard
              domain={domain}
              isSelected={selectedIds.has(domain.id)}
              onToggleSelect={() => onToggleSelect?.(domain.id)}
              onVerify={() => onVerify(domain)}
              onRemove={() => onRemove(domain.id, domain.domainName)}
              onArchive={
                onArchive
                  ? () => onArchive(domain.id, domain.domainName)
                  : undefined
              }
            />
          </motion.div>
        ))}

        {/* Free-tier CTA: treated as just another (last) grid item */}
        {!isPro && (
          <motion.div
            key="upgrade-cta"
            className="h-full"
            {...getItemMotionProps(domains.length)}
          >
            <UpgradeCard proMaxDomains={proMaxDomains} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
