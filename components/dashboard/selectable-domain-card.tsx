"use client";

import { motion } from "motion/react";
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

      {/* Checkbox - hidden by default, shown on hover/focus or when selected */}
      <div
        className={cn(
          "absolute top-3 left-3 z-10 transition-all duration-150",
          isSelected
            ? "opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={`Select ${domain.domainName}`}
          aria-pressed={isSelected}
          className={cn(
            "flex size-5 cursor-pointer items-center justify-center rounded transition-all",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "border-2 border-foreground/40 bg-transparent hover:border-foreground/60",
          )}
        >
          {isSelected && (
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
      </div>

      {/* The actual card */}
      <TrackedDomainCard
        domainName={domain.domainName}
        verified={domain.verified}
        verificationStatus={domain.verificationStatus}
        verificationMethod={domain.verificationMethod}
        expirationDate={domain.expirationDate}
        registrar={domain.registrar}
        dns={domain.dns}
        hosting={domain.hosting}
        email={domain.email}
        onVerify={onVerify}
        onRemove={onRemove}
        onArchive={onArchive}
        className={cn("h-full", isSelected && "bg-primary/10")}
      />
    </motion.div>
  );
}
