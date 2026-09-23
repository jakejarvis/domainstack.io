"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";

import { StaticBackground } from "@/components/layout/static-background";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@domainstack/ui/hooks";

/**
 * Animated gradient background with organic, drifting motion.
 * Uses varying animation durations and phases for a less predictable feel.
 * Each blob's random walk becomes a CSS @keyframes rule animating only transform and opacity,
 * so it runs off the main thread. Respects prefers-reduced-motion for accessibility.
 */
export function AnimatedBackground() {
  const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const baseId = useId();

  const mounted = useIsClient();
  const [blobs, setBlobs] = useState<Blob[] | null>(null);
  // Generate randomness only after hydration to keep SSR/prerender deterministic.
  if (mounted && blobs === null) {
    setBlobs(generateBlobs(createClientRand(), baseId));
  }

  if (!mounted) return null;

  if (shouldReduceMotion) return <StaticBackground />;

  return createPortal(
    <div
      data-slot="portal-background"
      className="pointer-events-none fixed top-0 left-0 -z-10 h-[100lvh] w-full overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/10 via-transparent to-accent-purple/10 dark:from-accent-blue/5 dark:to-accent-purple/5" />
      {blobs && <style>{blobs.map((b) => b.keyframes).join("\n")}</style>}
      {blobs?.map((b) => (
        <div key={b.name} className={b.className} style={b.style} />
      ))}
    </div>,
    document.body,
  );
}

type Blob = Readonly<{
  name: string;
  className: string;
  keyframes: string;
  style: React.CSSProperties;
}>;

function generateBlobs(rand: () => number, baseId: string): Blob[] {
  const layerStyles = [
    "h-[28rem] w-[28rem] bg-accent-blue/16 dark:bg-accent-blue/10 blur-3xl mix-blend-multiply",
    "h-[26rem] w-[26rem] bg-accent-purple/16 dark:bg-accent-purple/10 blur-3xl mix-blend-multiply",
    "h-[22rem] w-[22rem] bg-accent-blue/12 dark:bg-accent-blue/7 blur-3xl mix-blend-multiply",
    "h-[20rem] w-[20rem] bg-accent-purple/12 dark:bg-accent-purple/7 blur-3xl mix-blend-multiply",
    "h-[18rem] w-[18rem] bg-accent-blue/9 dark:bg-accent-blue/5 blur-3xl mix-blend-multiply",
  ] as const;

  // useId output isn't a valid CSS identifier
  const idPrefix = `blob-${baseId.replace(/[^\w-]/g, "")}`;

  return layerStyles.map((layerClass, idx) => {
    const startX = randRange(rand, 12, 78);
    const startY = randRange(rand, 12, 78);
    const drift = randRange(rand, 10, 26);
    const steps = randInt(rand, 6, 10);

    const x = randomWalkKeyframes(rand, startX, drift, steps, 6, 94);
    const y = randomWalkKeyframes(rand, startY, drift, steps, 6, 94);
    const scale = randomWalkKeyframes(rand, 1, 0.18, steps, 0.82, 1.28);
    const rotate = randomWalkKeyframes(rand, randRange(rand, -6, 6), 12, steps, -18, 18);
    const opacityBase = 0.45 + idx * 0.06;
    const opacity = randomWalkKeyframes(rand, opacityBase, 0.22, steps, 0.25, 0.9);

    const times = randomTimes(rand, steps);
    const duration = randRange(rand, 18, 42) + idx * randRange(rand, 1, 4);
    const delay = randRange(rand, 0, 6);

    const name = `${idPrefix}-${idx}`;
    const frames = times
      .map(
        (t, i) =>
          `${(t * 100).toFixed(2)}%{transform:translate(${x[i]}vw,${y[i]}vh) scale(${scale[i]}) rotate(${rotate[i]}deg);opacity:${opacity[i]}}`,
      )
      .join("");

    return {
      name,
      className: `absolute top-0 left-0 rounded-full will-change-transform ${layerClass}`,
      keyframes: `@keyframes ${name}{${frames}}`,
      style: {
        // before the delay elapses, the backwards fill holds the first keyframe (the start point)
        animation: `${name} ${duration}s ease-in-out ${delay}s infinite alternate both`,
      },
    } satisfies Blob;
  });
}

function createClientRand(): () => number {
  // Prefer crypto for better randomness (client-only), fallback to Math.random.
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(1);
      return () => {
        cryptoObj.getRandomValues(buf);
        return (buf[0] ?? 0) / 4_294_967_296;
      };
    }
  }
  return () => Math.random();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randRange(rand: () => number, min: number, max: number) {
  return min + rand() * (max - min);
}

function randInt(rand: () => number, min: number, max: number) {
  return Math.floor(randRange(rand, min, max + 1));
}

function randomWalkKeyframes(
  rand: () => number,
  start: number,
  drift: number,
  steps: number,
  min: number,
  max: number,
) {
  const frames: number[] = [clamp(start, min, max)];
  let current = start;
  for (let i = 0; i < steps - 1; i += 1) {
    const step = randRange(rand, -drift, drift);
    // Bias back toward center a bit so blobs don't hug edges forever.
    const center = (min + max) / 2;
    const pull = (center - current) * randRange(rand, 0.02, 0.08);
    current = clamp(current + step + pull, min, max);
    frames.push(current);
  }
  // Close the loop so the mirror repeat feels less like a hard reset.
  frames.push(frames[0] ?? start);
  return frames;
}

function randomTimes(rand: () => number, steps: number) {
  // `times` is 0..1 and must match keyframe array length.
  // We generate uneven segment durations for "lava lamp" pacing.
  const count = steps + 1; // plus the closing frame
  const weights = Array.from({ length: count - 1 }, () => randRange(rand, 0.5, 1.8));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const times: number[] = [0];
  let acc = 0;
  for (const w of weights) {
    acc += w / total;
    times.push(clamp(acc, 0, 1));
  }
  times[times.length - 1] = 1;
  return times;
}
