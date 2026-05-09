export function nonceFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAuthNonce(): Promise<string> {
  const Crypto = await import("expo-crypto");
  return nonceFromBytes(Crypto.getRandomValues(new Uint8Array(16)));
}
