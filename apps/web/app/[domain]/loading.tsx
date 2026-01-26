import { DomainReportSkeleton } from "@/components/domain/report-skeleton";

/**
 * Route-level loading UI for domain pages.
 * Matches the DomainReportView layout with beautiful skeleton states.
 * Prevents full blank shell during provider initialization.
 */
export default function DomainLoading() {
  return <DomainReportSkeleton />;
}
