import { clsx, type ClassValue } from "clsx";
import { defineConfig } from "cva";
import { twMerge } from "tailwind-merge";

export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export const { cva } = defineConfig({
  hooks: {
    onComplete: (className) => twMerge(className),
  },
});

export type { VariantProps } from "cva";
