import { type ClassValue, clsx } from "clsx";
import { defineConfig } from "cva";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const { cva } = defineConfig({
  hooks: {
    onComplete: (className) => twMerge(className),
  },
});

export { cn, cva };
export type { VariantProps } from "cva";
