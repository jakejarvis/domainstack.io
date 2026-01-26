import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
} from "@tabler/icons-react";

type SortIndicatorProps = {
  isSorted: false | "asc" | "desc";
};

export function SortIndicator({ isSorted }: SortIndicatorProps) {
  if (isSorted === "asc") {
    return <IconArrowUp className="size-3 shrink-0 text-primary" />;
  }
  if (isSorted === "desc") {
    return <IconArrowDown className="size-3 shrink-0 text-primary" />;
  }
  return <IconArrowsSort className="size-3 shrink-0 opacity-50" />;
}
