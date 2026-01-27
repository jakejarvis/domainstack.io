export { cn, cva, type VariantProps } from "@domainstack/ui/utils";

export const isMac = () =>
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;
