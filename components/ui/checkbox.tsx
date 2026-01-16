import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative size-4 shrink-0 rounded-[4px] border-2 border-foreground/40 bg-background shadow-xs outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[disabled]:cursor-not-allowed data-[checked]:border-primary data-[checked]:bg-primary data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="absolute inset-0 flex items-center justify-center text-current transition-transform duration-150 ease-out data-[checked]:scale-100 data-[unchecked]:scale-0"
      >
        <CheckIcon
          weight="bold"
          className="size-[87.5%] text-background"
          aria-hidden="true"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
