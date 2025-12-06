"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResumeDomainData } from "@/hooks/use-domain-verification";
import { AddDomainContent } from "./add-domain-content";

export type { ResumeDomainData };

export type AddDomainDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** If provided, skips step 1 and goes directly to verification */
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
};

/**
 * Reusable add domain dialog with verification wizard.
 * Uses AddDomainContent internally for the wizard steps.
 */
export function AddDomainDialog({
  open,
  onOpenChange,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: AddDomainDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {resumeDomain ? "Complete Verification" : "Add Domain"}
          </DialogTitle>
          <DialogDescription>
            {resumeDomain
              ? `Verify ownership of ${resumeDomain.domainName}`
              : "Track and monitor your domain"}
          </DialogDescription>
        </DialogHeader>
        <AddDomainContent
          showCard={false}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
          resumeDomain={resumeDomain}
          prefillDomain={prefillDomain}
        />
      </DialogContent>
    </Dialog>
  );
}
