import { View } from "react-native";

import { cn, cva, type VariantProps } from "@/lib/cn";

import { TextClassContext } from "./text";

const badgeVariants = cva({
  base: "flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1",
  variants: {
    variant: {
      default: "border-border bg-secondary",
      success: "bg-success-surface border-success-border",
      warning: "bg-warning-surface border-warning-border",
      danger: "border-destructive-border bg-destructive-surface",
      info: "bg-info-surface border-info-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const badgeLabelVariants = cva({
  base: "text-xs font-semibold tabular-nums",
  variants: {
    variant: {
      default: "text-muted-foreground",
      success: "text-success",
      warning: "text-warning",
      danger: "text-destructive",
      info: "text-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const badgeDotVariants = cva({
  base: "size-1.5 rounded-full opacity-85",
  variants: {
    variant: {
      default: "bg-muted-foreground",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-destructive",
      info: "bg-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({
  children,
  className,
  dot = false,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  variant?: Variant;
}) {
  const labelClassName = badgeLabelVariants({ variant });

  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      {dot ? <View className={badgeDotVariants({ variant })} /> : null}
      <TextClassContext.Provider value={labelClassName}>{children}</TextClassContext.Provider>
    </View>
  );
}
