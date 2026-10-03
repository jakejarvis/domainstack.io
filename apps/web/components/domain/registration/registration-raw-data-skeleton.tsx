import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

/** `p` = punctuation, `k` = key, `v` = value; the number is the width in `ch`. */
type Segment = readonly ["p" | "k" | "v", number];
/** Indent level (2 spaces each, like `JSON.stringify(_, null, 2)`) followed by segments. */
type SkeletonLine = readonly [indent: number, ...segments: Segment[]];

// Shaped like a typical pretty-printed RDAP domain response.
const RDAP_LINES: readonly SkeletonLine[] = [
  [0, ["p", 1]],
  [1, ["k", 18], ["v", 9]],
  [1, ["k", 9], ["v", 26]],
  [1, ["k", 10], ["v", 13]],
  [1, ["k", 8], ["p", 1]],
  [2, ["p", 1]],
  [3, ["k", 8], ["v", 44]],
  [3, ["k", 6], ["v", 7]],
  [3, ["k", 7], ["v", 46]],
  [3, ["k", 7], ["v", 23]],
  [2, ["p", 1]],
  [1, ["p", 2]],
  [1, ["k", 9], ["p", 1]],
  [2, ["v", 26]],
  [2, ["v", 28]],
  [2, ["v", 26]],
  [1, ["p", 2]],
  [1, ["k", 11], ["p", 1]],
  [2, ["p", 1]],
  [3, ["k", 18], ["v", 9]],
  [3, ["k", 9], ["v", 6]],
  [3, ["k", 8], ["p", 1]],
  [4, ["v", 11]],
  [3, ["p", 2]],
  [3, ["k", 12], ["p", 1]],
  [4, ["p", 1]],
  [5, ["k", 7], ["v", 20]],
  [5, ["k", 13], ["v", 5]],
  [4, ["p", 1]],
  [3, ["p", 2]],
  [3, ["k", 13], ["p", 1]],
  [4, ["v", 8]],
  [4, ["p", 1]],
  [5, ["p", 1]],
  [6, ["v", 10]],
  [6, ["p", 3]],
  [6, ["v", 7]],
  [6, ["v", 5]],
  [5, ["p", 2]],
];

// Shaped like a typical thin-registry WHOIS response.
const WHOIS_LINES: readonly SkeletonLine[] = [
  [0, ["k", 12], ["v", 11]],
  [0, ["k", 19], ["v", 23]],
  [0, ["k", 20], ["v", 22]],
  [0, ["k", 13], ["v", 30]],
  [0, ["k", 12], ["v", 20]],
  [0, ["k", 13], ["v", 20]],
  [0, ["k", 30], ["v", 20]],
  [0, ["k", 10], ["v", 34]],
  [0, ["k", 22], ["v", 3]],
  [0, ["k", 29], ["v", 24]],
  [0, ["k", 29], ["v", 15]],
  [0, ["k", 14], ["v", 46]],
  [0, ["k", 14], ["v", 48]],
  [0, ["k", 14], ["v", 46]],
  [0, ["k", 12], ["v", 14]],
  [0, ["k", 12], ["v", 14]],
  [0, ["k", 6], ["v", 14]],
  [0, ["k", 30], ["v", 26]],
  [0],
  [0, ["p", 4], ["v", 56]],
  [0],
  [0, ["v", 64]],
  [0, ["v", 62]],
  [0, ["v", 66]],
  [0, ["v", 60]],
  [0, ["v", 63]],
  [0, ["v", 24]],
  [0],
  [0, ["v", 65]],
  [0, ["v", 61]],
  [0, ["v", 64]],
  [0, ["v", 62]],
  [0, ["v", 38]],
  [0],
  [0, ["v", 63]],
  [0, ["v", 60]],
  [0, ["v", 47]],
];

const SEGMENT_TINT = {
  // Mirror the syntax colors so the RDAP placeholder previews the highlighted JSON.
  k: "bg-blue-500/15 dark:bg-blue-400/15",
  v: "bg-emerald-500/15 dark:bg-emerald-400/15",
  p: undefined,
} as const;

/**
 * Loading placeholder for the RDAP/WHOIS code pane, laid out on the same grid, row height, and
 * character columns as the loaded data so nothing shifts when it arrives.
 */
export function RegistrationRawDataSkeleton({ format }: { format: string }) {
  const isJson = format === "RDAP";
  const lines = isJson ? RDAP_LINES : WHOIS_LINES;

  return (
    <div
      className="h-full overflow-hidden mask-b-from-70% p-3"
      role="status"
      aria-label={`Loading raw ${format} data`}
    >
      <div aria-hidden className="grid grid-cols-[auto_1fr] font-mono text-xs leading-5">
        {lines.map(([indent, ...segments], index) => {
          const lineNumber = index + 1;
          return (
            <div key={lineNumber} className="col-span-2 grid grid-cols-subgrid px-1 py-0.5">
              <span
                className={cn(
                  "justify-self-end px-1 text-right text-muted-foreground/40 select-none",
                  // Long RDAP dumps run past 100 lines, so reserve the gutter they'll need.
                  isJson && "min-w-[calc(3ch+0.5rem)]",
                )}
              >
                {lineNumber}
              </span>
              <span
                className="flex h-5 items-center gap-[1ch] pr-1"
                style={{ paddingInlineStart: `calc(0.75rem + ${indent * 2}ch)` }}
              >
                {segments.map(([kind, width], segmentIndex) => (
                  <Skeleton
                    // Segments are static and never reorder.
                    // oxlint-disable-next-line react/no-array-index-key
                    key={segmentIndex}
                    className={cn(
                      "h-3 max-w-full shrink rounded-sm motion-reduce:animate-none",
                      isJson && SEGMENT_TINT[kind],
                    )}
                    style={{ width: `${width}ch` }}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
