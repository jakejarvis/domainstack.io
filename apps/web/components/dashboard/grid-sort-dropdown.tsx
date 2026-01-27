import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import { IconSortAscending, IconSortDescending } from "@tabler/icons-react";
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
                  <IconSortAscending className="size-4" />
                ) : (
                  <IconSortDescending className="size-4" />
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
