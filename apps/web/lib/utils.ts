import { type ClassValue, clsx } from "clsx";
import { defineConfig } from "cva";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const { cva } = defineConfig({
  hooks: {
    onComplete: (className) => twMerge(className),
  },
});
export type { VariantProps } from "cva";

export const isMac = () =>
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;
