"use client";

import { motion } from "motion/react";
import { TrackedDomainCard } from "@/components/dashboard/tracked-domain-card";
import { Checkbox } from "@/components/ui/checkbox";
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
      className="relative"
      animate={{ scale: isSelected ? 1.01 : 1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Selection ring overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-3xl transition-all duration-150",
          isSelected
            ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
            : "ring-0",
        )}
        aria-hidden
      />

      {/* Checkbox overlay */}
      <div className="absolute top-3 left-3 z-10">
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-lg transition-all",
            isSelected
              ? "bg-primary shadow-md"
              : "bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
          )}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${domain.domainName}`}
            className={cn(
              "border-0",
              isSelected && "bg-transparent text-primary-foreground",
            )}
          />
        </div>
      </div>

      {/* The actual card */}
      <TrackedDomainCard
        domainName={domain.domainName}
        verified={domain.verified}
        verificationStatus={domain.verificationStatus}
        expirationDate={domain.expirationDate}
        registrar={domain.registrar}
        dns={domain.dns}
        hosting={domain.hosting}
        email={domain.email}
        onVerify={onVerify}
        onRemove={onRemove}
        onArchive={onArchive}
        className={cn(isSelected && "bg-primary/10")}
      />
    </motion.div>
  );
}
