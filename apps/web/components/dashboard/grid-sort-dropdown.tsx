import {
  SortAscendingIcon,
  SortDescendingIcon,
} from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SORT_OPTIONS, type SortOption } from "@/lib/dashboard-utils";

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
            variant="ghost"
            className="inline-flex h-9 items-center gap-1.5 px-3"
          >
            <span className="text-muted-foreground">Sort:</span>
            {currentSort?.shortLabel ?? "Select"}
            {currentSort?.direction && (
              <span className="text-muted-foreground">
                {currentSort.direction === "asc" ? (
                  <SortAscendingIcon className="size-4 shrink-0 translate-y-[-1px]" />
                ) : (
                  <SortDescendingIcon className="size-4 shrink-0 translate-y-[-1px]" />
                )}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={sortOption}
          onValueChange={(value) => onSortChange(value as SortOption)}
        >
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
