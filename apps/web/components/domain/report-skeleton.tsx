import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";
import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";

/**
 * Skeleton for the header area (favicon, domain name, action buttons).
 * Used by loading.tsx when we don't have the domain name yet.
 */
function HeaderSkeleton() {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      {/* Left: favicon + domain name */}
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="size-5 shrink-0 rounded-xs" />
        <Skeleton className="h-5 w-38 rounded-sm" />
      </div>

      {/* Right: Track button + Export button + Tools dropdown */}
      {/* Buttons show icon-only on mobile, icon+text on desktop */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Track button: icon on mobile, icon+"Track" on desktop */}
        <Skeleton className="size-8 rounded-md sm:w-[76px]" />
        {/* Export button: icon on mobile, icon+"Export" on desktop */}
        <Skeleton className="size-8 rounded-md sm:w-[88px]" />
        {/* Tools dropdown: always icon-only */}
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the section navigation tabs.
 * Used by loading.tsx when we don't have the domain name yet.
 */
function SectionNavSkeleton() {
  return (
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
        <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto px-1 md:justify-center">
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
  );
}

/**
 * Skeleton for just the report sections (no header/nav).
 * Used as fallback when header/nav are already rendered with real data.
 */
function SectionsSkeleton() {
  return (
    <div className="space-y-4">
      <RegistrationSectionSkeleton />
      <HostingSectionSkeleton />
      <DnsSectionSkeleton />
      <CertificatesSectionSkeleton />
      <HeadersSectionSkeleton />
      <SeoSectionSkeleton />
    </div>
  );
}

/**
 * Full page loading state for domain reports.
 * Used by route-level loading.tsx when domain name is not yet available.
 * Contains the header skeleton, section nav skeleton, and all section skeletons.
 */
export function DomainReportSkeleton() {
  return (
    <div>
      <HeaderSkeleton />
      <SectionNavSkeleton />
      <SectionsSkeleton />
    </div>
  );
}
