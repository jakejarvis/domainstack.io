import { DomainSearchSkeleton } from "@/components/domain/domain-search-skeleton";

export function HeaderSearchSkeleton() {
  return (
    <div className="flex flex-1 justify-center">
      <div className="w-full max-w-2xl">
        <DomainSearchSkeleton variant="sm" />
      </div>
    </div>
  );
}
