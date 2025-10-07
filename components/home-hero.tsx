"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type HomeHeroProps = {
  words?: string[];
  intervalMs?: number;
  className?: string;
};

export function HomeHero({ intervalMs = 2400, className }: HomeHeroProps) {
  const rotatingWords = [
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

  const [index, setIndex] = useState(0);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % rotatingWords.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

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
    <div className={className}>
      <h1 className="flex w-full flex-col items-center justify-center gap-y-2 text-center font-semibold text-3xl leading-none tracking-tight sm:flex-row sm:items-baseline sm:gap-y-0 sm:text-4xl md:text-5xl">
        <span className="whitespace-nowrap text-foreground/90">
          Inspect any domain's
        </span>
        <motion.span
          className="ml-2.5 inline-flex items-center rounded-lg bg-muted/70 px-2 py-0.5 text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md sm:rounded-xl sm:px-3 sm:py-1"
          aria-live="polite"
          aria-atomic="true"
          initial={false}
          animate={{ width: measuredWidth ?? undefined }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: "width", width: measuredWidth ?? undefined }}
        >
          <span className="relative flex h-[1.15em] w-full items-center overflow-hidden whitespace-nowrap">
            <span className="-translate-x-1/2 absolute left-1/2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={rotatingWords[index]}
                  initial={{ y: "100%", opacity: 0, x: 0 }}
                  animate={{ y: 0, opacity: 1, x: 0 }}
                  exit={{ y: "-100%", opacity: 0, x: 0 }}
                  transition={{
                    type: "tween",
                    ease: [0.22, 1, 0.36, 1],
                    duration: 0.5,
                  }}
                  className="inline-block will-change-transform"
                >
                  {rotatingWords[index]}
                </motion.span>
              </AnimatePresence>
            </span>
            {/* in-flow baseline shim so the pill aligns with surrounding text baseline */}
            <span className="invisible select-none">
              {rotatingWords[index]}
            </span>
          </span>
        </motion.span>
        {/* measurement element for smooth width animation (inherits h1 font sizing) */}
        <span
          ref={measureRef}
          className="pointer-events-none invisible absolute inline-flex items-center rounded-lg bg-muted/70 px-2 py-0.5 align-baseline text-foreground shadow-sm ring-1 ring-border/60 sm:rounded-xl sm:px-3 sm:py-1"
          aria-hidden="true"
        >
          <span className="inline-flex items-center whitespace-nowrap">
            {rotatingWords[index]}
          </span>
        </span>
        <span className="hidden whitespace-nowrap text-foreground/90 sm:inline">
          .
        </span>
      </h1>
    </div>
  );
}
