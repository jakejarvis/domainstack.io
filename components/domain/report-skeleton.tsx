import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable loading state for domain reports.
 * Used by both route-level loading.tsx and Suspense fallback in DomainReportView.
 * Contains the header skeleton, section nav skeleton, and all section skeletons.
 */
export function DomainReportSkeleton() {
  return (
    <div>
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

      {/* Section navigation skeleton */}
      <div
        aria-hidden
        className={cn(
          "sticky z-40 -mx-4 mt-4 mb-4 px-4",
          // Mobile: claims top edge
          "top-0",
          // Desktop: below sticky global header
          "md:top-[var(--header-height)]",
        )}
      >
        <div
          className={cn(
            "relative flex items-center",
            "h-[var(--section-nav-height)]",
            // Full-width background using pseudo-element
            "before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2",
            "before:bg-background/80 before:backdrop-blur-md dark:before:bg-background/90",
            // Full-width bottom border with gradient fade (header visible state)
            "after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-screen after:-translate-x-1/2",
            "after:bg-gradient-to-r after:from-transparent after:via-black/5 after:to-transparent dark:after:via-white/10",
          )}
        >
          {/* Skeleton tabs - horizontally scrollable on mobile, centered on desktop */}
          <div className="scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto px-1 md:justify-center">
            {[125, 140, 130, 145, 135, 130].map((width, index) => (
              <Skeleton
                key={`tab-${index}-${width}`}
                className="h-8 shrink-0 rounded-md"
                style={{ width }}
              />
            ))}
          </div>
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
