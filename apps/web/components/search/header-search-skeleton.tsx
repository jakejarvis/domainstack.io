import { SearchSkeleton } from "@/components/search/search-skeleton";

export function HeaderSearchSkeleton() {
  return (
    <div className="flex flex-1 justify-center">
      <div className="w-full max-w-2xl">
        <SearchSkeleton variant="sm" />
      </div>
    </div>
  );
}
