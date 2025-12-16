"use client";

import { HeartIcon, type LucideProps } from "lucide-react";
import { motion, type SVGMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

const MotionHeartIcon = motion.create(HeartIcon);

export function HeartAnimated({
  className,
  ...props
}: Omit<SVGMotionProps<SVGSVGElement>, "children"> & LucideProps) {
  return (
    <MotionHeartIcon
      className={cn(
        "fill-destructive stroke-destructive will-change-transform",
        className,
      )}
      animate={{ scale: [1, 1.08, 1, 1.08, 1, 1] }}
      transition={{
        duration: 1.2,
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: 0.8,
      }}
      {...props}
    />
  );
}
