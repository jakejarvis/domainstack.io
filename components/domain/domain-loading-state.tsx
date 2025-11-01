import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reusable loading state for domain reports.
 * Used by both route-level loading.tsx and Suspense fallback in DomainReportView.
 * Contains the header skeleton and all section skeletons.
 */
export function DomainLoadingState() {
  return (
    <div className="space-y-4">
      {/* Domain header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="space-y-4">
        <RegistrationSectionSkeleton />
        <HostingSectionSkeleton />
        <DnsSectionSkeleton />
        <CertificatesSectionSkeleton />
        <HeadersSectionSkeleton />
        <SeoSectionSkeleton />
      </div>
    </div>
  );
}
