"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Animated gradient background with organic, drifting motion.
 * Uses varying animation durations and phases for a less predictable feel.
 * Respects prefers-reduced-motion for accessibility.
 */
export function AnimatedBackground() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="-z-10 pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 via-transparent to-accent-purple/5" />

      {/* Primary blue blob - slow drift with scale */}
      <motion.div
        className="absolute h-96 w-96 rounded-full bg-accent-blue/10 blur-3xl"
        initial={{ x: "25vw", y: "25vh", scale: 1, opacity: 0.8 }}
        animate={
          shouldReduceMotion
            ? { x: "25vw", y: "25vh", scale: 1, opacity: 0.8 }
            : {
                x: ["25vw", "20vw", "30vw", "22vw", "25vw"],
                y: ["25vh", "30vh", "20vh", "35vh", "25vh"],
                scale: [1, 1.1, 0.95, 1.05, 1],
                opacity: [0.8, 0.6, 0.9, 0.7, 0.8],
              }
        }
        transition={{
          duration: 25,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />

      {/* Secondary purple blob - different rhythm */}
      <motion.div
        className="absolute h-96 w-96 rounded-full bg-accent-purple/10 blur-3xl"
        initial={{ x: "60vw", y: "55vh", scale: 1, opacity: 0.7 }}
        animate={
          shouldReduceMotion
            ? { x: "60vw", y: "55vh", scale: 1, opacity: 0.7 }
            : {
                x: ["60vw", "70vw", "55vw", "65vw", "60vw"],
                y: ["55vh", "45vh", "60vh", "50vh", "55vh"],
                scale: [1, 0.9, 1.15, 0.95, 1],
                opacity: [0.7, 0.9, 0.6, 0.8, 0.7],
              }
        }
        transition={{
          duration: 31,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />

      {/* Tertiary subtle blob - adds depth with offset timing */}
      <motion.div
        className="absolute h-72 w-72 rounded-full bg-accent-blue/5 blur-3xl"
        initial={{ x: "45vw", y: "70vh", scale: 1, opacity: 0.5 }}
        animate={
          shouldReduceMotion
            ? { x: "45vw", y: "70vh", scale: 1, opacity: 0.5 }
            : {
                x: ["45vw", "50vw", "40vw", "48vw", "45vw"],
                y: ["70vh", "65vh", "75vh", "68vh", "70vh"],
                scale: [1, 1.2, 0.85, 1.1, 1],
                opacity: [0.5, 0.3, 0.6, 0.4, 0.5],
              }
        }
        transition={{
          duration: 19,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />
    </div>
  );
}
