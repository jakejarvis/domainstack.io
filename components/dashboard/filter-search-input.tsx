import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/ssr";
import { AnimatePresence, motion } from "motion/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

type FilterSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function FilterSearchInput({ value, onChange }: FilterSearchInputProps) {
  return (
    <div className="flex-1 lg:max-w-xs">
      <InputGroup>
        <InputGroupAddon>
          <MagnifyingGlassIcon />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search domains..."
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{
                  duration: 0.16,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
              >
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => onChange("")}
                  aria-label="Clear search"
                >
                  <XIcon />
                </InputGroupButton>
              </motion.div>
            </InputGroupAddon>
          )}
        </AnimatePresence>
      </InputGroup>
    </div>
  );
}
