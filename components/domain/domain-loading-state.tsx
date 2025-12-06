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
      {/* Domain header skeleton - matches DomainReportHeader */}
      <div className="flex min-w-0 items-center justify-between gap-4">
        {/* Left: favicon + domain name */}
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded" />
          <Skeleton className="h-7 w-40" />
        </div>

        {/* Right: Track button + Export button + Tools dropdown */}
        {/* Buttons show icon-only on mobile, icon+text on desktop */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Track button: icon on mobile, icon+"Track" on desktop */}
          <Skeleton className="size-9 rounded-md sm:h-9 sm:w-[76px]" />
          {/* Export button: icon on mobile, icon+"Export" on desktop */}
          <Skeleton className="size-9 rounded-md sm:h-9 sm:w-[88px]" />
          {/* Tools dropdown: always icon-only */}
          <Skeleton className="size-9 rounded-md" />
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
