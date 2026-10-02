import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer";
import type { Page } from "puppeteer";

/**
 * Compiled ads-and-tracking engine, serialized next to the runner at image
 * build time. Building it at runtime would download and parse fourteen filter
 * lists from raw.githubusercontent.com before every capture, so the engine
 * ships inside the image instead.
 */
export const ENGINE_PATH = fileURLToPath(new URL("adblock-engine.bin", import.meta.url));

/**
 * `skipped` means the capture failed before blocking was set up, so it says
 * nothing about the engine. Only `unavailable` indicates a broken image.
 */
export type AdblockStatus = "enabled" | "skipped" | "unavailable";

/** Fetch and compile the prebuilt filter lists. Image build time only. */
export function compileBlocker(): Promise<PuppeteerBlocker> {
  return PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch);
}

/** Load the engine baked into the image. Never touches the network. */
export async function loadBlocker(): Promise<PuppeteerBlocker> {
  const serialized = await readFile(ENGINE_PATH);
  return PuppeteerBlocker.deserialize(new Uint8Array(serialized));
}

/**
 * Blocking is best-effort: a capture without it is still useful, so a missing
 * or unreadable engine degrades instead of failing. The returned status is
 * reported so a broken image does not go unnoticed.
 */
export async function enableAdBlocking(page: Page): Promise<AdblockStatus> {
  try {
    const blocker = await loadBlocker();
    await blocker.enableBlockingInPage(page);
    return "enabled";
  } catch {
    return "unavailable";
  }
}
