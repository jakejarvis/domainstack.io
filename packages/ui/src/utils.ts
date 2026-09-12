import { cn as mergeClasses } from "cn";
import { defineConfig } from "cva/config";

export const { cva, cx: cn } = defineConfig({ cx: mergeClasses });

export type { VariantProps } from "cva";
