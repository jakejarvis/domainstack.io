"use client";

import { motion } from "motion/react";
import { TrackedDomainCard } from "@/components/dashboard/tracked-domain-card";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

type TrackedDomainsGridProps = {
  domains: TrackedDomainWithDetails[];
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
};

export function TrackedDomainsGrid({
  domains,
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
          transition={{ delay: Math.min(index * 0.1, 0.5), duration: 0.3 }}
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
            onRemove={() => onRemove(domain.id, domain.domainName)}
            onArchive={
              onArchive
                ? () => onArchive(domain.id, domain.domainName)
                : undefined
            }
          />
        </motion.div>
      ))}
    </div>
  );
}
