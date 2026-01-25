import { Menu } from "@base-ui/react/menu";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import { CaretRightIcon, CheckIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

function MenubarMenu({ ...props }: Menu.Root.Props) {
  return <Menu.Root data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({ ...props }: Menu.Group.Props) {
  return <Menu.Group data-slot="menubar-group" {...props} />;
}

function MenubarPortal({ ...props }: Menu.Portal.Props) {
  return <Menu.Portal data-slot="menubar-portal" {...props} />;
}

function MenubarRadioGroup({ ...props }: Menu.RadioGroup.Props) {
  return <Menu.RadioGroup data-slot="menubar-radio-group" {...props} />;
}

function MenubarTrigger({ className, ...props }: Menu.Trigger.Props) {
  return (
    <Menu.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex select-none items-center rounded-sm px-2 py-1 font-medium text-sm outline-hidden hover:bg-muted aria-expanded:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  side = "bottom",
  ...props
}: Menu.Popup.Props &
  Pick<
    Menu.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenubarPortal>
      <Menu.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50 outline-none"
      >
        <Menu.Popup
          data-slot="menubar-content"
          className={cn(
            "min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden ring-1 ring-foreground/10",
            "max-h-[var(--available-height)] origin-[var(--transform-origin)] overflow-y-auto duration-100",
            "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in",
            "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </MenubarPortal>
  );
}

function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: Menu.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Menu.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/menubar-item relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "data-[variant=destructive]:*:[svg]:!text-destructive data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20",
        "not-data-[variant=destructive]:focus:**:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function MenubarCheckboxItem({
  className,
  children,
  ...props
}: Menu.CheckboxItem.Props) {
  return (
    <Menu.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <Menu.CheckboxItemIndicator>
          <CheckIcon aria-hidden="true" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

function MenubarRadioItem({
  className,
  children,
  ...props
}: Menu.RadioItem.Props) {
  return (
    <Menu.RadioItem
      data-slot="menubar-radio-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <Menu.RadioItemIndicator>
          <CheckIcon aria-hidden="true" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

function MenubarLabel({
  className,
  inset,
  ...props
}: Menu.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <Menu.GroupLabel
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 font-medium text-sm data-[inset]:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSeparator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator
      data-slot="menubar-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest group-focus/menubar-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSub({ ...props }: Menu.SubmenuRoot.Props) {
  return <Menu.SubmenuRoot data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: Menu.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <Menu.SubmenuTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-open:bg-accent data-open:text-accent-foreground",
        "data-popup-open:bg-accent data-popup-open:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto" aria-hidden="true" />
    </Menu.SubmenuTrigger>
  );
}

function MenubarSubContent({
  className,
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  ...props
}: Menu.Popup.Props &
  Pick<
    Menu.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50 outline-none"
      >
        <Menu.Popup
          data-slot="menubar-sub-content"
          className={cn(
            "min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg outline-hidden ring-1 ring-foreground/10",
            "max-h-[var(--available-height)] origin-[var(--transform-origin)] overflow-y-auto duration-100",
            "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in",
            "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
