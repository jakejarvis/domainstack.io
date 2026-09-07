import { cn } from "@domainstack/ui/utils";

/**
 * Parenthesized relative time that is safe to SSR.
 *
 * Relative copy needs a client clock (`useHydratedNow`). Until that clock
 * exists, this renders an invisible `()` around a `<time dateTime>` so the
 * layout and machine-readable instant stay in the HTML without a fake
 * "loading" label. Invalid dates render nothing.
 *
 * `suppressHydrationWarning` is required on both the wrapper (class/ARIA
 * change) and the `<time>` (text change). The warning only covers one
 * level, and the shared clock can flip during a long hydration pass.
 */
export function RelativeTimeSuffix({
  dateTime,
  text,
  className,
}: {
  dateTime: string | undefined;
  text: string | null;
  className?: string;
}) {
  if (!dateTime) return null;

  return (
    <span
      className={cn(!text && "invisible", className)}
      aria-hidden={!text || undefined}
      suppressHydrationWarning
    >
      {"("}
      <time dateTime={dateTime} suppressHydrationWarning>
        {text}
      </time>
      {")"}
    </span>
  );
}
