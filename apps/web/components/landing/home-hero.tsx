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

// shared by the word swap and the pill resize so both land together
const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION_S = 0.5;

const RESIZE_ANIMATION: KeyframeAnimationOptions = {
  duration: DURATION_S * 1000,
  easing: `cubic-bezier(${EASE.join(", ")})`,
};

const HEADING_COMPLETION =
  "registration, DNS records, hosting, email, SEO, certificates, and more.";

export function HomeHero({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const width = widths?.[index];

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const leadRef = useRef<HTMLSpanElement | null>(null);
  const capLeftRef = useRef<HTMLSpanElement | null>(null);
  const pillMidRef = useRef<HTMLSpanElement | null>(null);
  const capRightRef = useRef<HTMLSpanElement | null>(null);
  const trailRef = useRef<HTMLSpanElement | null>(null);
  const prevWidthRef = useRef(width);

  // paused in background tabs so queued index changes don't replay out of sync with the width
  useEffect(() => {
    if (shouldReduceMotion) return;
    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (id !== undefined) return;
      id = setInterval(() => {
        if (pausedRef.current) return;
        setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
      }, INTERVAL_MS);
    };
    const stop = () => {
      if (id === undefined) return;
      clearInterval(id);
      id = undefined;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [shouldReduceMotion]);

  // measure every word up front so the target width lands in the same render as the swap
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const mirrors = Array.from(measureRef.current.children);
    let raf = 0;
    const measure = () => {
      const next = mirrors.map((mirror) => mirror.getBoundingClientRect().width);
      setWidths((prev) => {
        if (prev && prev.length === next.length && prev.every((w, i) => w === next[i])) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    for (const mirror of mirrors) ro.observe(mirror);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // FLIP: the pill's width snaps, then its background and neighbors animate back with
  // transforms only; transitioning `width` reflows the heading every frame. the background
  // is three-sliced so only the flat middle scales: scaling the whole pill would squash its
  // corners and thin its side borders mid-resize
  useLayoutEffect(() => {
    const prev = prevWidthRef.current;
    prevWidthRef.current = width;
    if (!prev || !width || prev === width || shouldReduceMotion) return;

    const shift = (width - prev) / 2;
    const mid = pillMidRef.current?.offsetWidth ?? 0;
    const prevMid = mid - (width - prev);
    const animations = [
      capLeftRef.current?.animate(
        [{ transform: `translateX(${shift}px)` }, { transform: "none" }],
        RESIZE_ANIMATION,
      ),
      capRightRef.current?.animate(
        [{ transform: `translateX(${-shift}px)` }, { transform: "none" }],
        RESIZE_ANIMATION,
      ),
      mid > 0 && prevMid > 0
        ? pillMidRef.current?.animate(
            [{ transform: `scaleX(${prevMid / mid})` }, { transform: "none" }],
            RESIZE_ANIMATION,
          )
        : undefined,
      // the period rides the pill's right edge (desktop only; hidden when stacked)
      trailRef.current?.animate(
        [{ transform: `translateX(${-shift}px)` }, { transform: "none" }],
        RESIZE_ANIMATION,
      ),
    ];
    // the lead-in only moves when it shares the pill's row, not when stacked on mobile
    if (headingRef.current && getComputedStyle(headingRef.current).flexDirection === "row") {
      animations.push(
        leadRef.current?.animate(
          [{ transform: `translateX(${shift}px)` }, { transform: "none" }],
          RESIZE_ANIMATION,
        ),
      );
    }
    return () => {
      for (const animation of animations) animation?.cancel();
    };
  }, [width, shouldReduceMotion]);

  // the sr-only span is the heading's real text; the visual pill is aria-hidden and draws its
  // words as ::before content so crawlers and copy/paste don't pick them up
  return (
    <h1
      ref={headingRef}
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-y-2 text-center text-3xl leading-none font-semibold tracking-tight sm:flex-row sm:items-baseline sm:gap-y-0 sm:text-4xl md:text-5xl",
        className,
      )}
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
    >
      <span ref={leadRef} className="whitespace-nowrap text-foreground/90">
        Inspect any domain&rsquo;s
      </span>{" "}
      <span className="sr-only">{HEADING_COMPLETION}</span>
      <span
        className="relative inline-flex items-center px-2 py-0.5 text-foreground sm:ml-2.5 sm:px-3 sm:py-1"
        style={{ width }}
        aria-hidden
      >
        {/* caps are exactly one corner radius wide; borders (not a ring) so each slice
            draws only its own edges, and a zero-blur shadow so none bleeds into a neighbor */}
        <span className="absolute -inset-px *:absolute *:inset-y-0 *:border-ring/20 *:bg-muted/40 *:shadow-[0_1px_0_rgb(0_0_0/0.05)]">
          <span
            ref={capLeftRef}
            className="left-0 w-(--radius-lg) rounded-l-lg border border-r-0 sm:w-(--radius-md) sm:rounded-l-md"
          />
          <span
            ref={pillMidRef}
            className="inset-x-(--radius-lg) border-y sm:inset-x-(--radius-md)"
          />
          <span
            ref={capRightRef}
            className="right-0 w-(--radius-lg) rounded-r-lg border border-l-0 sm:w-(--radius-md) sm:rounded-r-md"
          />
        </span>
        {/* vertical clip only: the outgoing word can be wider than the new width */}
        <span className="relative flex h-[1.15em] w-full items-center overflow-x-visible overflow-y-clip whitespace-nowrap">
          {/* one shared grid cell, so the outgoing and incoming words cross in place
              instead of taking turns */}
          <span className="absolute left-1/2 grid -translate-x-1/2 justify-items-center *:col-start-1 *:row-start-1">
            <AnimatePresence initial={false}>
              <m.span
                key={ROTATING_WORDS[index]}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                // leaves a beat faster than the next word arrives, so they never overlap legibly
                exit={{ y: "-100%", opacity: 0, transition: { duration: DURATION_S * 0.6 } }}
                transition={{ type: "tween", ease: EASE, duration: DURATION_S }}
                data-word={ROTATING_WORDS[index]}
                className="inline-block will-change-[transform,opacity] before:content-[attr(data-word)]"
              />
            </AnimatePresence>
          </span>
          <span
            data-word={ROTATING_WORDS[index]}
            className="invisible select-none before:content-[attr(data-word)]"
          />
        </span>
      </span>
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute top-0 left-0 flex h-0 flex-col items-start overflow-hidden"
        aria-hidden
      >
        {ROTATING_WORDS.map((word) => (
          <span
            key={word}
            data-word={word}
            className="px-2 py-0.5 whitespace-nowrap before:content-[attr(data-word)] sm:px-3 sm:py-1"
          />
        ))}
      </span>
      <span
        ref={trailRef}
        className="hidden whitespace-nowrap text-foreground/90 before:content-['.'] sm:inline-block"
        aria-hidden
      />
    </h1>
  );
}
