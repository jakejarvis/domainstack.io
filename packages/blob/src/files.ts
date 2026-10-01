import { createHmac } from "node:crypto";
import path from "node:path";

import { createFiles } from "files-sdk";
import { contentType } from "files-sdk/content-type";
import { fs } from "files-sdk/fs";
import { vercelBlob } from "files-sdk/vercel-blob";

import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "blob" });

/** Public path the dev fallback writes under; `next dev` serves it from `public/`. */
const DEV_BLOB_DIR = "_dev-blob";

/**
 * In local development without Blob credentials, store files on disk under
 * the web app's `public/` directory so the dev server can serve them.
 */
function shouldUseLocalFiles(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.BLOB_READ_WRITE_TOKEN &&
    !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
  );
}

function buildAdapter() {
  if (!shouldUseLocalFiles()) {
    // Defaults: public access, addRandomSuffix: false, allowOverwrite: true
    return vercelBlob();
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  logger.info({ dir: `public/${DEV_BLOB_DIR}` }, "blob not configured, storing files locally");
  return fs({
    // `next dev` runs with the web app as its working directory
    root: path.join(process.cwd(), "public", DEV_BLOB_DIR),
    urlBaseUrl: `${baseUrl.replace(/\/$/, "")}/${DEV_BLOB_DIR}`,
  });
}

function buildFiles() {
  return createFiles({
    adapter: buildAdapter(),
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
 * throws at construction when no credentials are configured. In development
 * without credentials it falls back to local files (see `buildAdapter`).
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
