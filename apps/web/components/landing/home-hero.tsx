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

const HEADING_COMPLETION =
  "registration, DNS records, hosting, email, SEO, certificates, and more.";

export function HomeHero({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [widths, setWidths] = useState<number[] | null>(null);

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
        if (prev && prev.length === next.length && prev.every((width, i) => width === next[i])) {
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

  // the sr-only span is the heading's real text; the visual pill is aria-hidden and draws its
  // words as ::before content so crawlers and copy/paste don't pick them up
  return (
    <h1
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
      <span className="whitespace-nowrap text-foreground/90">Inspect any domain&rsquo;s</span>{" "}
      <span className="sr-only">{HEADING_COMPLETION}</span>
      <span
        className="ml-2.5 inline-flex items-center rounded-lg bg-muted/40 px-2 py-0.5 text-foreground shadow-sm ring-1 ring-ring/20 transition-[width] duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:rounded-md sm:px-3 sm:py-1"
        style={{ width: widths?.[index] }}
        aria-hidden
      >
        <span className="relative flex h-[1.15em] w-full items-center overflow-hidden whitespace-nowrap">
          <span className="absolute left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={ROTATING_WORDS[index]}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
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
        className="hidden whitespace-nowrap text-foreground/90 before:content-['.'] sm:inline"
        aria-hidden
      />
    </h1>
  );
}
