import * as motion from "motion/react-client";
import { TrackedDomainCard } from "@/components/dashboard/tracked-domain-card";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type SelectableDomainCardProps = {
  domain: TrackedDomainWithDetails;
  isSelected: boolean;
  onToggleSelect: () => void;
  onVerify: () => void;
  onRemove: () => void;
  onArchive?: () => void;
};

export function SelectableDomainCard({
  domain,
  isSelected,
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
}: SelectableDomainCardProps) {
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
      <TrackedDomainCard
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
        onVerify={onVerify}
        onRemove={onRemove}
        onArchive={onArchive}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        className={cn("h-full", isSelected && "bg-primary/10")}
      />
    </motion.div>
  );
}
