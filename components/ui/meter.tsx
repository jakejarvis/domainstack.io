"use client";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";

import { cn } from "@/lib/utils";

function Meter({ className, children, ...props }: MeterPrimitive.Root.Props) {
  return (
    <MeterPrimitive.Root
      data-slot="meter"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      {...props}
    >
      <MeterPrimitive.Track data-slot="meter-track" className="h-full w-full">
        <MeterPrimitive.Indicator
          data-slot="meter-indicator"
          className="h-full bg-primary transition-all"
        />
      </MeterPrimitive.Track>
      {children}
    </MeterPrimitive.Root>
  );
}

const MeterTrack = MeterPrimitive.Track;
const MeterIndicator = MeterPrimitive.Indicator;
const MeterLabel = MeterPrimitive.Label;
const MeterValue = MeterPrimitive.Value;

export { Meter, MeterTrack, MeterIndicator, MeterLabel, MeterValue };
