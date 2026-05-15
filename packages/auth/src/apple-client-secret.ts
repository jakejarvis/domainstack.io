import { importPKCS8, SignJWT } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
// Apple's documented maximum lifetime for the client-secret JWT.
const MAX_LIFETIME_SECONDS = 60 * 60 * 24 * 180;
// Re-sign once the live secret is within this window of expiring so a
// long-lived process never serves an expired JWT to Apple.
const REFRESH_BEFORE_EXPIRY_MS = 1000 * 60 * 60 * 24 * 14;

export interface AppleClientSecretInput {
  /** Apple Developer Team ID (10-character string). */
  teamId: string;
  /** Key ID associated with the .p8 private key. */
  keyId: string;
  /** Services ID (web) or App Bundle ID acting as the JWT `sub`. */
  clientId: string;
  /** PKCS#8 PEM string of the .p8 private key, including BEGIN/END markers. */
  privateKey: string;
}

/**
 * Build a fresh Apple "client secret" JWT signed with the .p8 private key.
 *
 * Apple's OAuth flow uses a short-lived JWT (≤6 months) as the client secret
 * instead of a static string. Prefer {@link AppleClientSecret} which keeps a
 * live value refreshed; this is the low-level signer it delegates to.
 */
export async function generateAppleClientSecret(input: AppleClientSecretInput): Promise<string> {
  const key = await importPKCS8(input.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: input.keyId })
    .setIssuer(input.teamId)
    .setSubject(input.clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_LIFETIME_SECONDS)
    .sign(key);
}

/**
 * Decode a base64-encoded .p8 private key back to its PEM string form.
 * Storing the key as base64 in env vars avoids newline-escaping headaches.
 */
export function decodeApplePrivateKey(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Owns the live Apple client-secret JWT and re-signs it lazily before it
 * expires. Better Auth reads `clientSecret` on every authorization-code
 * exchange, so wiring {@link current} behind a getter keeps the value fresh
 * without coupling to process lifetime (cold start, long-lived server, etc).
 */
export class AppleClientSecret {
  private value: string;
  private expiresAt: number;
  private refreshing = false;

  static async create(input: AppleClientSecretInput): Promise<AppleClientSecret> {
    const value = await generateAppleClientSecret(input);
    return new AppleClientSecret(input, value);
  }

  private constructor(
    private readonly input: AppleClientSecretInput,
    value: string,
  ) {
    this.value = value;
    this.expiresAt = Date.now() + MAX_LIFETIME_SECONDS * 1000;
  }

  /**
   * Return the current secret, kicking off a background re-sign when it is
   * within {@link REFRESH_BEFORE_EXPIRY_MS} of expiry. Synchronous so it can
   * back a property getter; the old value keeps serving until the refresh
   * resolves (and stays put if it fails).
   */
  current(): string {
    if (!this.refreshing && this.expiresAt - Date.now() < REFRESH_BEFORE_EXPIRY_MS) {
      this.refreshing = true;
      generateAppleClientSecret(this.input)
        .then((next) => {
          this.value = next;
          this.expiresAt = Date.now() + MAX_LIFETIME_SECONDS * 1000;
        })
        .catch(() => undefined)
        .finally(() => {
          this.refreshing = false;
        });
    }
    return this.value;
  }
}
