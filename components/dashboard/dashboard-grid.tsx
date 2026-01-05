import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { UpgradeCard } from "@/components/dashboard/upgrade-card";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";
import { DashboardGridCard } from "./dashboard-grid-card";

type DashboardGridProps = {
  domains: TrackedDomainWithDetails[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
};

// Stable empty Set to avoid creating new instance on every render
const EMPTY_SET = new Set<string>();

/**
 * Memoized grid item to prevent re-renders when parent updates but item data hasn't changed.
 * Handles callback binding internally to avoid inline functions in the parent map.
 */
const GridItem = memo(function GridItem({
  domain,
  isSelected,
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
}: {
  domain: TrackedDomainWithDetails;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
}) {
  const handleToggleSelect = useCallback(() => {
    onToggleSelect?.(domain.id);
  }, [onToggleSelect, domain.id]);

  const handleVerify = useCallback(() => {
    onVerify(domain);
  }, [onVerify, domain]);

  const handleRemove = useCallback(() => {
    onRemove(domain.id, domain.domainName);
  }, [onRemove, domain.id, domain.domainName]);

  const handleArchive = useCallback(() => {
    onArchive?.(domain.id, domain.domainName);
  }, [onArchive, domain.id, domain.domainName]);

  return (
    <motion.div
      className="group relative h-full"
      animate={{ scale: isSelected ? 1.01 : 1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Selection ring overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition-all duration-150",
          isSelected
            ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
            : "ring-0",
        )}
        aria-hidden
      />

      {/* The actual card with integrated checkbox */}
      <DashboardGridCard
        trackedDomainId={domain.id}
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
        isSelected={isSelected}
        onVerify={handleVerify}
        onRemove={handleRemove}
        onArchive={handleArchive}
        onToggleSelect={handleToggleSelect}
        className={cn("h-full", isSelected && "bg-primary/10")}
      />
    </motion.div>
  );
});

export function DashboardGrid({
  domains,
  selectedIds = EMPTY_SET,
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
}: DashboardGridProps) {
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
            <GridItem
              domain={domain}
              isSelected={selectedIds.has(domain.id)}
              onToggleSelect={onToggleSelect}
              onVerify={onVerify}
              onRemove={onRemove}
              onArchive={onArchive}
            />
          </motion.div>
        ))}

        {/* Free-tier CTA: treated as just another (last) grid item */}
        <motion.div
          key="upgrade-cta"
          className="h-full"
          {...getItemMotionProps(domains.length)}
        >
          <UpgradeCard />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
