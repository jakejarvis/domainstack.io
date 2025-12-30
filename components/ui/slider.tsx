import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full select-none flex-col data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="flex w-full touch-none items-center py-1.5 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="rounded-full bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          />
          {Array.from({ length: _values.length }, (_, index) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              // Base UI needs explicit index when multiple thumbs are used.
              index={index}
              key={`thumb-${_values.length}-${index}`}
              className="size-4 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:outline-hidden focus-visible:ring-4 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
