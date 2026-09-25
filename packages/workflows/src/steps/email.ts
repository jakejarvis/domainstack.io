import { FatalError, getStepMetadata, RetryableError } from "workflow";

interface SendEmailParams {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** React Email component to render */
  react: React.ReactElement;
  /**
   * Identity of this logical email across workflow runs. When omitted, the
   * enclosing step id is used, which dedupes retries of that step only.
   */
  idempotencyKey?: string;
}

/** First name for an email greeting, or "there" when the name is blank. */
export function getFirstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

export function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new FatalError("NEXT_PUBLIC_BASE_URL is required to send workflow emails");
  }
  return baseUrl;
}

/**
 * Step-internal helper for sending emails via Resend with proper error classification.
 *
 * It must be called from a `"use step"` function because React elements are not
 * serializable workflow values. It uses the enclosing step's ID as an
 * idempotency key, which is stable across retries and unique per step. Pass
 * `idempotencyKey` to identify the email by its logical content instead, so a
 * later run that re-sends the same email is deduped by Resend as well.
 * See: https://useworkflow.dev/docs/foundations/idempotency
 *
 * Error handling:
 * - Validation/auth errors (4xx except 429) → FatalError (don't retry)
 * - Rate limit/quota errors (429) → RetryableError with delay
 * - Server errors (5xx) → RetryableError with backoff
 * - Idempotency conflicts → FatalError or RetryableError depending on type
 */
export async function sendEmail(params: SendEmailParams): Promise<{ emailId: string }> {
  const { sendEmail: sendResendEmail } = await import("@domainstack/email");

  const { to, subject, react } = params;

  // Resend keys are length-limited, so hash caller-provided keys.
  let idempotencyKey: string;
  if (params.idempotencyKey) {
    const { createHash } = await import("node:crypto");
    idempotencyKey = `k:${createHash("sha256").update(params.idempotencyKey).digest("hex")}`;
  } else {
    // Use stepId as idempotency key - stable across retries and unique per step
    idempotencyKey = getStepMetadata().stepId;
  }
  const baseUrl = getBaseUrl();

  const { data, error } = await sendResendEmail(
    { to, subject, react },
    { baseUrl, idempotencyKey },
  );

  if (!error && data?.id) {
    return { emailId: data.id };
  }

  if (!error) {
    // Unexpected: no error but also no data - treat as transient
    throw new RetryableError(`Email send returned no data or error, will retry`, {
      retryAfter: "5s",
    });
  }

  // Classify the error based on Resend error types
  const errorName = error.name;
  const errorMessage = error.message;

  // Permanent failures - don't retry
  const permanentErrors = [
    "validation_error",
    "missing_required_field",
    "missing_api_key",
    "restricted_api_key",
    "invalid_api_key",
    "not_found",
    "method_not_allowed",
    "invalid_attachment",
    "invalid_from_address",
    "invalid_access",
    "invalid_parameter",
    "invalid_region",
    "invalid_idempotent_request", // Same key with different payload
  ];

  if (permanentErrors.includes(errorName)) {
    throw new FatalError(`Email send failed: ${errorName} - ${errorMessage}`);
  }

  // Rate limit / quota errors - retry with appropriate delay
  if (errorName === "daily_quota_exceeded") {
    // Daily quota resets after 24 hours - no point retrying within workflow
    throw new FatalError(`Email send failed: ${errorName} - ${errorMessage}`);
  }

  if (errorName === "monthly_quota_exceeded") {
    // Monthly quota requires plan upgrade - no point retrying
    throw new FatalError(`Email send failed: ${errorName} - ${errorMessage}`);
  }

  // Concurrent idempotent request - retry after a short delay
  if (errorName === "concurrent_idempotent_requests") {
    throw new RetryableError(`Email send failed: ${errorName}`, {
      retryAfter: "2s",
    });
  }

  // Rate limit (2 req/s) - retry after a short delay
  // Note: Resend returns retry-after header but we don't have access to it via SDK
  // Base 1s is safe for 2 req/s; jitter spreads out concurrent runs hitting
  // the same limit so their retries don't resynchronize on the same tick.
  if (errorName === "rate_limit_exceeded") {
    const jitterMs = Math.floor(Math.random() * 500);
    throw new RetryableError(`Email send failed: ${errorName}`, {
      retryAfter: 1000 + jitterMs,
    });
  }

  // Server/application errors - retry with backoff
  if (errorName === "application_error" || errorName === "internal_server_error") {
    throw new RetryableError(`Email send failed: ${errorName}`, {
      retryAfter: "5s",
    });
  }

  // Unknown error - assume transient and retry
  throw new RetryableError(`Email send failed: ${errorName} - ${errorMessage}`, {
    retryAfter: "5s",
  });
}
