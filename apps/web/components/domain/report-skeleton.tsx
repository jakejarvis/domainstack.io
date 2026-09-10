import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

/**
 * Skeleton for the header area (favicon, domain name, action buttons).
 * Used by loading.tsx when we don't have the domain name yet.
 */
function HeaderSkeleton() {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      {/* Left: favicon + domain name + camera/spinner slot */}
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="size-5 shrink-0 rounded-xs" />
        <Skeleton className="h-7 w-38 rounded-sm" />
        <Skeleton className="mr-3 ml-0.5 size-3.5 shrink-0 rounded-full" />
      </div>

      {/* Right: Track button + Export button + Tools dropdown */}
      {/* Buttons show icon-only on mobile, icon+text on desktop (default h-9) */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Track button: icon on mobile, icon+"Track" on desktop */}
        <Skeleton className="h-9 w-9 rounded-md sm:w-[86px]" />
        {/* Export button: icon on mobile, icon+"Export" on desktop */}
        <Skeleton className="h-9 w-9 rounded-md sm:w-[93px]" />
        {/* Tools dropdown: always icon-only (size="icon") */}
        <Skeleton className="size-9 rounded-md" />
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
          "before:bg-background/80 before:backdrop-blur",
          // Full-width bottom border with gradient fade (header visible state)
          "after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-screen after:-translate-x-1/2",
          "after:bg-gradient-to-r after:from-transparent after:via-black/10 after:to-transparent dark:after:via-white/10",
        )}
      >
        {/* Skeleton tabs - horizontally scrollable on mobile, centered on desktop */}
        <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto px-1 md:justify-center">
          {/* Widths approximate each SectionNav tab: icon + label at `text-[13px]` */}
          {[
            { key: "registration", w: 117 },
            { key: "hosting", w: 139 },
            { key: "dns", w: 124 },
            { key: "certificates", w: 142 },
            { key: "headers", w: 129 },
            { key: "seo", w: 122 },
          ].map(({ key, w }) => (
            <Skeleton key={key} className="h-8 shrink-0 rounded-md" style={{ width: w }} />
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
