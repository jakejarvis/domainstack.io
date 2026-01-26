import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";

export type FilterChip = {
  type: "search" | "status" | "health" | "tld" | "provider" | "domainId";
  value: string;
  label: string;
  prefix?: string;
  icon: React.ReactNode;
};

type FilterChipsProps = {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
};

export function FilterChips({ chips, onRemove }: FilterChipsProps) {
  const shouldReduceMotion = useReducedMotion();

  if (chips.length === 0) {
    return null;
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="active-filter-chips"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        transition={{
          duration: shouldReduceMotion ? 0.1 : 0.18,
          ease: [0.22, 1, 0.36, 1] as const,
        }}
        className="flex flex-wrap gap-2"
      >
        <AnimatePresence initial={false}>
          {chips.map((chip, index) => (
            <motion.div
              key={
                chip.type === "search" ? "search" : `${chip.type}-${chip.value}`
              }
              layout={shouldReduceMotion ? false : "position"}
              initial={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 6,
                scale: shouldReduceMotion ? 1 : 0.98,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : -6,
                scale: shouldReduceMotion ? 1 : 0.98,
              }}
              transition={{
                duration: shouldReduceMotion ? 0.1 : 0.18,
                ease: [0.22, 1, 0.36, 1] as const,
                delay: shouldReduceMotion ? 0 : Math.min(index * 0.01, 0.06),
              }}
              className="inline-flex"
            >
              <Badge className="select-none gap-1.5 border-border bg-muted/10 py-1 pr-1.5 text-foreground dark:bg-muted/30">
                {chip.icon}
                <span className="flex items-center gap-1 text-xs leading-none">
                  {chip.prefix && (
                    <span className="shrink-0 text-muted-foreground">
                      {chip.prefix}:
                    </span>
                  )}
                  <span className="truncate">{chip.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(chip)}
                  className="cursor-pointer rounded-full p-[3px] hover:bg-muted/90"
                  aria-label={`Remove ${chip.type} filter`}
                >
                  <IconX className="size-3" />
                </button>
              </Badge>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
