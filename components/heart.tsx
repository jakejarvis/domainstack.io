"use client";

import { motion, type SVGMotionProps, useReducedMotion } from "motion/react";

export function HeartAnimated(props: SVGMotionProps<SVGSVGElement>) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={
        shouldReduceMotion ? undefined : { scale: [1, 1.08, 1, 1.08, 1, 1] }
      }
      transition={
        shouldReduceMotion
          ? undefined
          : {
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 0.8,
            }
      }
      {...props}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </motion.svg>
  );
}
