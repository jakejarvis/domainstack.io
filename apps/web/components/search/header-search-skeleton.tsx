import { SearchSkeleton } from "@/components/search/search-skeleton";

export function HeaderSearchSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 justify-center overflow-hidden">
      <div className="w-full max-w-2xl">
        <SearchSkeleton variant="sm" />
      </div>
    </div>
  );
}
