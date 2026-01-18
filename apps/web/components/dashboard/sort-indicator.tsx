import {
  ArrowDownIcon,
  ArrowsDownUpIcon,
  ArrowUpIcon,
} from "@phosphor-icons/react/ssr";

type SortIndicatorProps = {
  isSorted: false | "asc" | "desc";
};

export function SortIndicator({ isSorted }: SortIndicatorProps) {
  if (isSorted === "asc") {
    return <ArrowUpIcon className="size-3 shrink-0 text-primary" />;
  }
  if (isSorted === "desc") {
    return <ArrowDownIcon className="size-3 shrink-0 text-primary" />;
  }
  return <ArrowsDownUpIcon className="size-3 shrink-0 opacity-50" />;
}
