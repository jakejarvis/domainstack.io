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
 * A three-state checkbox for per-domain notification overrides.
 *
 * Cycling behavior depends on the global setting:
 * - When global is OFF: inherit → on → off → inherit (full 3-state)
 * - When global is ON:  inherit → off → inherit (skips explicit ON since it matches global)
 *
 * This UX always starts by overriding with the opposite of global,
 * allowing users to quickly toggle away from the default.
 */
export function ThreeStateCheckbox({
  value,
  globalValue,
  onChange,
  disabled,
}: ThreeStateCheckboxProps) {
  const isInherited = value === undefined;
  const effectiveValue = value ?? globalValue;

  const handleClick = () => {
    if (isInherited) {
      // First click: override with opposite of global
      onChange(!globalValue);
    } else if (value === true) {
      // Explicit ON → explicit OFF
      onChange(false);
    } else {
      // Explicit OFF → back to inherit
      onChange(undefined);
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
