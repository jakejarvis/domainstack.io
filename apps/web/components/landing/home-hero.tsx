"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@domainstack/ui/utils";

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
  const [widths, setWidths] = useState<number[] | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // every word is measured up front so the pill's target width is available in the same render
  // as the word swap; the observer re-measures after font loads, zoom and breakpoint changes
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const mirrors = Array.from(measureRef.current.children);
    const measure = () => {
      // subpixel widths, otherwise integer rounding jitters the transition by a pixel
      setWidths(mirrors.map((mirror) => mirror.getBoundingClientRect().width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const mirror of mirrors) ro.observe(mirror);
    return () => ro.disconnect();
  }, []);

  return (
    <h1
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-y-2 text-center text-3xl leading-none font-semibold tracking-tight sm:flex-row sm:items-baseline sm:gap-y-0 sm:text-4xl md:text-5xl",
        className,
      )}
    >
      <span className="whitespace-nowrap text-foreground/90">Inspect any domain&rsquo;s</span>
      {/* width is transitioned in CSS so the surrounding words reflow smoothly alongside it,
          without a per-frame JS animation loop or layout-projection scaling */}
      <span
        className="ml-2.5 inline-flex items-center rounded-lg bg-muted/40 px-2 py-0.5 text-foreground shadow-sm ring-1 ring-ring/20 transition-[width] duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:rounded-md sm:px-3 sm:py-1"
        style={{ width: widths?.[index] }}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="relative flex h-[1.15em] w-full items-center overflow-hidden whitespace-nowrap">
          <span className="absolute left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={ROTATING_WORDS[index]}
                initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
                transition={{
                  type: "tween",
                  ease: [0.22, 1, 0.36, 1],
                  duration: shouldReduceMotion ? 0.15 : 0.5,
                }}
                className="inline-block will-change-[transform,opacity]"
              >
                {ROTATING_WORDS[index]}
              </m.span>
            </AnimatePresence>
          </span>
          {/* in-flow baseline shim so the pill aligns with surrounding text baseline */}
          <span className="invisible select-none">{ROTATING_WORDS[index]}</span>
        </span>
      </span>
      {/* mirrors the pill's padding at the h1's font sizing so each word's target width is exact */}
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute top-0 left-0 flex flex-col items-start"
        aria-hidden
      >
        {ROTATING_WORDS.map((word) => (
          <span key={word} className="px-2 py-0.5 whitespace-nowrap sm:px-3 sm:py-1">
            {word}
          </span>
        ))}
      </span>
      <span className="hidden whitespace-nowrap text-foreground/90 sm:inline">.</span>
    </h1>
  );
}
