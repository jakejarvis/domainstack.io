import { importPKCS8, SignJWT } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
// Apple's documented maximum lifetime for the client-secret JWT.
const MAX_LIFETIME_SECONDS = 60 * 60 * 24 * 180;

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
 * instead of a static string. We regenerate it on every cold start so an
 * operator never has to rotate it by hand.
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
