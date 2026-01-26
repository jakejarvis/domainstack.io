"use client";

import { useEffect } from "react";

export function VibrationProvider() {
  useEffect(() => {
    // Detect Safari version
    const ua = navigator.userAgent;
    let version = null;
    if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) {
      const match = ua.match(/Version\/(\d+(\.\d+)?)/);
      if (match?.[1]) {
        version = parseFloat(match[1]);
      }
    }

    // Determine support level
    const support =
      !navigator.vibrate && version
        ? version >= 18.4
          ? "granted"
          : version >= 18
            ? "full"
            : null
        : null;

    if (!support) {
      return;
    }

    // State
    let checkbox: HTMLInputElement;
    let timeout: ReturnType<typeof setTimeout>;
    let lastTouch: number | null = null;
    let state: [number, number[]] = [Date.now(), []];

    // Adjust pattern based on elapsed time
    function adjustPattern(elapsed: number, pattern: number[]): number[] {
      const result: number[] = [];
      let remaining = elapsed;

      for (let i = 0; i < pattern.length; i++) {
        const duration = pattern[i];
        if (remaining > 0) {
          const diff = duration - remaining;
          if (diff > 0) {
            if (!result.length && i % 2) {
              result.push(0);
            }
            result.push(diff);
            remaining = 0;
          } else {
            remaining = Math.abs(diff);
          }
        } else {
          if (!result.length && i % 2) {
            result.push(0);
          }
          result.push(duration);
        }
      }
      return result;
    }

    // Sleep with drift correction
    async function sleep(ms: number): Promise<number> {
      const start = Date.now();
      return new Promise((resolve) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(ms - (Date.now() - start)), ms);
      });
    }

    // Process vibration queue
    async function process() {
      lastTouch = Date.now();
      let drift = 0;

      for (;;) {
        const [timestamp, pattern] = state;
        const adjusted = adjustPattern(Date.now() - timestamp, pattern);
        state = [Date.now(), adjusted];

        const [vibrateDuration, ...rest] = adjusted;

        if (vibrateDuration == null) {
          // Pattern exhausted - for "granted" mode, poll briefly in case more
          // vibrations arrive while user interaction is still recent
          if (support !== "full" && lastTouch) {
            const wait = Math.max(0, 1000 - (Date.now() - lastTouch));
            if (wait > 0) {
              await sleep(1);
              continue;
            }
          }
          return;
        }

        const shouldVibrate = vibrateDuration > 0;
        const delay = (shouldVibrate ? 26.26 : (rest[0] ?? 0)) + drift;

        if (shouldVibrate) {
          checkbox.click();
        }
        drift = await sleep(delay);
      }
    }

    // Handle user interactions
    function onInteraction(e: Event) {
      if (e.target !== checkbox && e.target !== checkbox.parentElement) {
        void process();
      }
    }

    // Polyfill navigator.vibrate
    navigator.vibrate = (pattern) => {
      const p = typeof pattern === "number" ? [pattern] : [...pattern];
      if (!p.length || p.some((n) => typeof n !== "number")) {
        return false;
      }
      state = [Date.now(), p];
      return true;
    };

    // Create hidden checkbox
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";

    checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("switch", "");
    label.appendChild(checkbox);

    // Attach event listeners
    window.addEventListener("click", onInteraction);
    window.addEventListener("touchend", onInteraction);
    window.addEventListener("keyup", onInteraction);
    window.addEventListener("keypress", onInteraction);

    // Mount
    if (document.head) {
      document.head.appendChild(label);
    } else {
      setTimeout(() => document.head.appendChild(label), 0);
    }
  }, []);

  return null;
}
