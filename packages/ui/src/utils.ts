import { cn } from "cn";
import { defineConfig } from "cva/config";

export { cn };

export const { cva } = defineConfig({
  cx: cn,
});
export type { VariantProps } from "cva/config";
