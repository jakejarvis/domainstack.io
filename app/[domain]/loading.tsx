import { DomainLoadingState } from "@/components/domain/domain-loading-state";

/**
 * Route-level loading UI for domain pages.
 * Matches the DomainReportView layout with beautiful skeleton states.
 * Prevents full blank shell during provider initialization.
 */
export default function DomainLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <DomainLoadingState />
    </div>
  );
}
