"use client";

import { motion } from "motion/react";
import { TrackedDomainCard } from "@/components/dashboard/tracked-domain-card";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

type TrackedDomainsGridProps = {
  domains: TrackedDomainWithDetails[];
  onAddDomain: () => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string) => void;
  onArchive?: (id: string) => void;
};

export function TrackedDomainsGrid({
  domains,
  onAddDomain: _onAddDomain,
  onVerify,
  onRemove,
  onArchive,
}: TrackedDomainsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {domains.map((domain, index) => (
        <motion.div
          key={domain.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
        >
          <TrackedDomainCard
            domainName={domain.domainName}
            verified={domain.verified}
            verificationStatus={domain.verificationStatus}
            expirationDate={domain.expirationDate}
            registrar={domain.registrar}
            dns={domain.dns}
            hosting={domain.hosting}
            email={domain.email}
            onVerify={() => onVerify(domain)}
            onRemove={() => onRemove(domain.id)}
            onArchive={onArchive ? () => onArchive(domain.id) : undefined}
          />
        </motion.div>
      ))}
    </div>
  );
}
