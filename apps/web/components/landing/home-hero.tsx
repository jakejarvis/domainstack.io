"use client";

import { cn } from "@domainstack/ui/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ROTATING_WORDS = [
  "registration",
  "DNS records",
  "hosting",
  "email",
  "SEO",
  "certificates",
  "headers",
  "servers",
  "IP addresses",
  "geolocation",
  "sitemaps",
  "meta tags",
];

const INTERVAL_MS = 2400;

export function HomeHero({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const el = measureRef.current;
    const update = () => {
      setMeasuredWidth(el.offsetWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Width updates are driven by ResizeObserver measuring the hidden mirror node

  return (
    <h1
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-y-2 text-center font-semibold text-3xl leading-none tracking-tight sm:flex-row sm:items-baseline sm:gap-y-0 sm:text-4xl md:text-5xl",
        className,
      )}
    >
      <span className="whitespace-nowrap text-foreground/90">
        Inspect any domain&rsquo;s
      </span>
      <motion.span
        className="ml-2.5 inline-flex items-center rounded-lg bg-muted/40 px-2 py-0.5 text-foreground shadow-sm ring-1 ring-ring/20 will-change-[width,transform] sm:rounded-md sm:px-3 sm:py-1"
        aria-live="polite"
        aria-atomic="true"
        initial={false}
        animate={{ width: measuredWidth ?? undefined }}
        transition={{
          duration: shouldReduceMotion ? 0.1 : 0.85,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ width: measuredWidth ?? undefined }}
      >
        <span className="relative flex h-[1.15em] w-full items-center overflow-hidden whitespace-nowrap">
          <span className="absolute left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={ROTATING_WORDS[index]}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { y: "100%", opacity: 0, x: 0 }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { y: 0, opacity: 1, x: 0 }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { y: "-100%", opacity: 0, x: 0 }
                }
                transition={{
                  type: "tween",
                  ease: [0.22, 1, 0.36, 1],
                  duration: shouldReduceMotion ? 0.15 : 0.5,
                }}
                className="inline-block will-change-[transform,opacity]"
              >
                {ROTATING_WORDS[index]}
              </motion.span>
            </AnimatePresence>
          </span>
          {/* in-flow baseline shim so the pill aligns with surrounding text baseline */}
          <span className="invisible select-none">{ROTATING_WORDS[index]}</span>
        </span>
      </motion.span>
      {/* measurement element for smooth width animation (inherits h1 font sizing) */}
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute top-0 left-0 inline-flex items-center px-2 py-0.5 align-baseline sm:px-3 sm:py-1"
        aria-hidden
      >
        <span className="inline-flex items-center whitespace-nowrap">
          {ROTATING_WORDS[index]}
        </span>
      </span>
      <span className="hidden whitespace-nowrap text-foreground/90 sm:inline">
        .
      </span>
    </h1>
  );
}
