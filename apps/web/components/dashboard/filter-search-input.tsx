import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@domainstack/ui/input-group";
import { IconSearch, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type FilterSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function FilterSearchInput({ value, onChange }: FilterSearchInputProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex-1 lg:max-w-xs">
      <InputGroup>
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput
          name="domain-search"
          placeholder="Search domains…"
          aria-label="Search domains"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <AnimatePresence initial={false}>
          {value && (
            <InputGroupAddon align="inline-end">
              <motion.div
                initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.16,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
              >
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => onChange("")}
                  aria-label="Clear search"
                >
                  <IconX />
                </InputGroupButton>
              </motion.div>
            </InputGroupAddon>
          )}
        </AnimatePresence>
      </InputGroup>
    </div>
  );
}
