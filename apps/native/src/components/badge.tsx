import { View } from "react-native";

import { cn, cva, type VariantProps } from "@/lib/cn";

import { TextClassContext } from "./text";

const badgeVariants = cva({
  base: "flex-row items-center gap-1 self-start rounded-full border px-2.5 py-1",
  variants: {
    variant: {
      default: "border-border bg-secondary",
      success: "border-success bg-success/16",
      warning: "border-warning bg-warning/16",
      danger: "border-destructive bg-destructive/16",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const badgeLabelVariants = cva({
  base: "text-xs font-semibold",
  variants: {
    variant: {
      default: "text-muted-foreground",
      success: "text-success",
      warning: "text-warning",
      danger: "text-destructive",
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
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
}) {
  const labelClassName = badgeLabelVariants({ variant });

  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      <TextClassContext.Provider value={labelClassName}>{children}</TextClassContext.Provider>
    </View>
  );
}
