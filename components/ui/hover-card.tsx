import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "@/lib/utils";

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  side,
  alignOffset,
  collisionPadding,
  sticky,
  positionMethod,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "side"
    | "sideOffset"
    | "collisionPadding"
    | "sticky"
    | "positionMethod"
  >) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        sticky={sticky}
        positionMethod={positionMethod}
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
            "origin-[var(--transform-origin)] transition-[transform,opacity] duration-200 will-change-[transform,opacity]",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
