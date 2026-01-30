import { Menu } from "@base-ui/react/menu";
import { IconCheck, IconChevronRight } from "@tabler/icons-react";
import { cn } from "../utils";

function DropdownMenu({ ...props }: Menu.Root.Props) {
  return <Menu.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: Menu.Portal.Props) {
  return <Menu.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: Menu.Popup.Props &
  Pick<
    Menu.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <DropdownMenuPortal>
      <Menu.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        // pointer-events: auto ensures the menu is clickable when rendered inside
        // modal dialogs (like vaul drawers) that set pointer-events: none on body
        className="pointer-events-auto isolate z-50 outline-none"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden ring-1 ring-foreground/10",
            "max-h-[var(--available-height)] origin-[var(--transform-origin)] overflow-y-auto overflow-x-hidden duration-100",
            "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in",
            "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-closed:overflow-hidden",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </DropdownMenuPortal>
  );
}

function DropdownMenuGroup({ ...props }: Menu.Group.Props) {
  return <Menu.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onSelect,
  onClick,
  ...props
}: Menu.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
  onSelect?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-[inset]:pl-8",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive",
        "not-data-[variant=destructive]:focus:**:text-accent-foreground",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(event);
      }}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: Menu.CheckboxItem.Props) {
  return (
    <Menu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden",
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <Menu.CheckboxItemIndicator>
          <IconCheck className="size-4" aria-hidden="true" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: Menu.RadioGroup.Props) {
  return <Menu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: Menu.RadioItem.Props) {
  return (
    <Menu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden",
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <Menu.RadioItemIndicator>
          <IconCheck className="size-4" aria-hidden="true" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Menu.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <Menu.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs data-[inset]:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest group-focus/dropdown-menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: Menu.SubmenuRoot.Props) {
  return <Menu.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Menu.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <Menu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-open:bg-accent data-open:text-accent-foreground",
        "data-popup-open:bg-accent data-popup-open:text-accent-foreground",
        "not-data-[variant=destructive]:focus:**:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <IconChevronRight className="ml-auto" aria-hidden="true" />
    </Menu.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn("w-auto min-w-24 rounded-md shadow-lg", className)}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
