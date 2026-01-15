import { CheckIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SORT_OPTIONS, type SortOption } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

type GridSortDropdownProps = {
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
};

export function GridSortDropdown({
  sortOption,
  onSortChange,
}: GridSortDropdownProps) {
  const currentSort = SORT_OPTIONS.find((o) => o.value === sortOption);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="inline-flex h-9 items-center gap-1.5 px-3"
          >
            <span className="text-muted-foreground">Sort:</span>
            {currentSort?.shortLabel ?? "Select"}
            {currentSort?.direction && (
              <span className="text-muted-foreground">
                {currentSort.direction === "asc" ? "↑" : "↓"}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onSortChange(option.value)}
            className="cursor-pointer gap-2"
          >
            <CheckIcon
              className={cn(
                sortOption === option.value ? "opacity-100" : "opacity-0",
              )}
            />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
