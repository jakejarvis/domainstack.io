"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[disabled]:cursor-not-allowed data-[checked]:bg-primary data-[unchecked]:bg-input data-[disabled]:opacity-50 dark:data-[unchecked]:bg-input/80",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform will-change-transform data-[checked]:translate-x-[calc(100%-2px)] data-[unchecked]:translate-x-0 dark:data-[checked]:bg-primary-foreground dark:data-[unchecked]:bg-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
