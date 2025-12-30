import { type ClassValue, clsx } from "clsx";
import { defineConfig, type VariantProps } from "cva";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const { cva } = defineConfig({
  hooks: {
    onComplete: (className) => twMerge(className),
  },
});

export { cn, cva, type VariantProps };
