"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThreeStateCheckboxProps {
  /** Current override value (undefined = inherit from global) */
  value: boolean | undefined;
  /** The global default value */
  globalValue: boolean;
  /** Callback when value changes */
  onChange: (value: boolean | undefined) => void;
  /** Whether the checkbox is disabled */
  disabled: boolean;
}

/**
 * A three-state checkbox that cycles through: inherit → on → off → inherit.
 * Used for per-domain notification overrides.
 */
export function ThreeStateCheckbox({
  value,
  globalValue,
  onChange,
  disabled,
}: ThreeStateCheckboxProps) {
  const isInherited = value === undefined;
  const effectiveValue = value ?? globalValue;

  // Three-state cycle: inherit → on → off → inherit
  const handleClick = () => {
    if (isInherited) {
      // If inheriting and global is on, set to explicit off (override)
      // If inheriting and global is off, set to explicit on (override)
      onChange(!globalValue);
    } else if (value === true) {
      onChange(false);
    } else {
      onChange(undefined); // Back to inherit
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Checkbox
            checked={isInherited ? "indeterminate" : effectiveValue}
            onCheckedChange={handleClick}
            disabled={disabled}
            className={cn("h-5 w-5", isInherited && "opacity-50")}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {isInherited
          ? `Inheriting from global (${globalValue ? "enabled" : "disabled"})`
          : value
            ? "Explicitly enabled"
            : "Explicitly disabled"}
      </TooltipContent>
    </Tooltip>
  );
}
