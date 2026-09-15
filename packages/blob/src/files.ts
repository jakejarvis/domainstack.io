import { createHmac } from "node:crypto";

import { createFiles } from "files-sdk";
import { contentType } from "files-sdk/content-type";
import { vercelBlob } from "files-sdk/vercel-blob";

import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "blob" });

function buildFiles() {
  return createFiles({
    // Defaults: public access, addRandomSuffix: false, allowOverwrite: true
    adapter: vercelBlob(),
    // Store the Content-Type sniffed from the bytes, not the one implied by the key
    plugins: [contentType()],
    // 3 attempts total, 100ms then 200ms backoff
    retries: 2,
    hooks: {
      onRetry: ({ key, attempt, maxRetries, delayMs, error }) =>
        logger.warn(
          { err: error, key, attempt, maxRetries, retryDelay: delayMs },
          "blob upload retry",
        ),
    },
  });
}

let files: ReturnType<typeof buildFiles> | undefined;

/**
 * Shared storage client, built on first use because the Vercel Blob adapter
 * throws at construction when no credentials are configured.
 */
export function getFiles(): ReturnType<typeof buildFiles> {
  return (files ??= buildFiles());
}

/**
 * Deterministic, obfuscated storage key: `<hmac>/<filename>`.
 *
 * The HMAC-SHA256 digest of `kind:parts...` (truncated to 32 hex chars) keeps
 * keys stable across uploads, so re-storing overwrites the existing object,
 * without exposing the inputs in the public URL.
 */
export function blobKey(kind: string, parts: Array<string | number>, filename: string): string {
  const secret = process.env.BLOB_SIGNING_SECRET;
  if (!secret && process.env.NODE_ENV !== "development") {
    throw new Error("BLOB_SIGNING_SECRET is not set");
  }

  const digest = createHmac("sha256", secret || "dev-hmac-secret")
    .update(`${kind}:${parts.join(":")}`)
    .digest("hex")
    .slice(0, 32);

  return `${digest}/${filename}`;
}
