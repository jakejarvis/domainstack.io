export function nonceFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface AuthNonce {
  raw: string;
  hashed: string;
}

// Apple's documented convention is to pass SHA256(raw) as the OIDC nonce and
// verify the digest server-side. better-auth's id-token verifier does literal
// string equality against the JWT `nonce` claim, so we forward `hashed` to both
// the IdP and better-auth — the digest matches on both sides while aligning
// with Apple's spec.
export async function createAuthNonce(): Promise<AuthNonce> {
  const Crypto = await import("expo-crypto");
  const raw = nonceFromBytes(Crypto.getRandomValues(new Uint8Array(16)));
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}
